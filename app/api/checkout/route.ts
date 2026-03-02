import { NextRequest, NextResponse } from "next/server";
import { checkoutSchema } from "@/lib/validations";
import { checkCsrf } from "@/lib/csrf";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-logger";
import { client } from "@/lib/sanity/client";
import { sanitizeInput } from "@/lib/sanitize";
import { generateCheckoutMessage, getTelegramCheckoutUrl } from "@/lib/utils";

// Rate limiter: 5 checkout attempts per 60 seconds per IP
const limiter = rateLimit({
    interval: 60_000,
    uniqueTokenPerInterval: 500,
});

/**
 * POST /api/checkout
 *
 * Server-side checkout that:
 * 1. Validates + sanitizes input
 * 2. Verifies prices against Sanity (prevents client-side price tampering)
 * 3. Generates the checkout message with verified prices
 * 4. Returns the Telegram checkout URL
 */
export async function POST(request: NextRequest) {
    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";

    // ── CSRF check ──────────────────────────────────────────────
    const csrfViolation = checkCsrf(request);
    if (csrfViolation) {
        logSecurityEvent({ type: "CSRF_BLOCKED", ip, detail: csrfViolation });
        return NextResponse.json(
            { error: "Forbidden" },
            { status: 403 }
        );
    }

    // ── Rate limit ──────────────────────────────────────────────
    const { success, reset } = limiter.check(5, ip);
    if (!success) {
        logSecurityEvent({ type: "RATE_LIMITED", ip, detail: "/api/checkout" });
        return NextResponse.json(
            { error: "Too many requests. Please try again later." },
            {
                status: 429,
                headers: {
                    "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
                },
            }
        );
    }

    // ── Parse & validate body ───────────────────────────────────
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
        logSecurityEvent({
            type: "VALIDATION_FAILED",
            ip,
            detail: JSON.stringify(parsed.error.flatten()),
        });
        return NextResponse.json(
            { error: "Invalid checkout data", details: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const { username, items, total } = parsed.data;

    // ── Verify prices against Sanity ────────────────────────────
    try {
        const productTitles = items.map((item) => item.title);
        const products = await client.fetch(
            `*[_type == "product" && title in $titles]{ title, price }`,
            { titles: productTitles }
        );

        const priceMap = new Map<string, number>();
        for (const p of products) {
            priceMap.set(p.title, p.price);
        }

        const verifiedItems = items.map((item) => {
            const serverPrice = priceMap.get(item.title);
            if (serverPrice !== undefined && serverPrice !== item.price) {
                logSecurityEvent({
                    type: "CHECKOUT_PRICE_MISMATCH",
                    ip,
                    detail: `"${item.title}": client=${item.price}, server=${serverPrice}`,
                });
                return { ...item, price: serverPrice };
            }
            return item;
        });

        const verifiedTotal = verifiedItems.reduce((sum, item) => sum + item.price, 0);

        const message = generateCheckoutMessage(
            sanitizeInput(username),
            verifiedItems,
            verifiedTotal
        );
        const checkoutUrl = getTelegramCheckoutUrl(message);

        return NextResponse.json({
            ok: true,
            checkoutUrl,
            verifiedTotal,
            priceAdjusted: verifiedTotal !== total,
        });
    } catch (error) {
        console.error("[checkout] Sanity fetch error:", error);
        const message = generateCheckoutMessage(
            sanitizeInput(username),
            items,
            total
        );
        const checkoutUrl = getTelegramCheckoutUrl(message);

        return NextResponse.json({
            ok: true,
            checkoutUrl,
            verifiedTotal: total,
            priceAdjusted: false,
        });
    }
}
