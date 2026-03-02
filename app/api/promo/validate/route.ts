import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { checkCsrf } from "@/lib/csrf";
import { logSecurityEvent } from "@/lib/security-logger";
import { client } from "@/lib/sanity/client";
import { sanitizeInput } from "@/lib/sanitize";
import { z } from "zod";

// Rate limiter: 5 promo checks per 60 seconds per IP
const limiter = rateLimit({
    interval: 60_000,
    uniqueTokenPerInterval: 500,
});

const promoRequestSchema = z.object({
    code: z.string().min(1).max(30).transform((s) => sanitizeInput(s).toUpperCase()),
    orderTotal: z.number().positive().optional(),
});

/**
 * POST /api/promo/validate
 *
 * Validates a promo code against Sanity.
 * Returns the discount info or an error.
 */
export async function POST(request: NextRequest) {
    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";

    // CSRF check
    const csrfViolation = checkCsrf(request);
    if (csrfViolation) {
        logSecurityEvent({ type: "CSRF_BLOCKED", ip, detail: csrfViolation });
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit
    const { success, reset } = limiter.check(5, ip);
    if (!success) {
        logSecurityEvent({ type: "RATE_LIMITED", ip, detail: "/api/promo/validate" });
        return NextResponse.json(
            { error: "Слишком много попыток. Подождите." },
            {
                status: 429,
                headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) },
            }
        );
    }

    // Parse body
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = promoRequestSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Неверный запрос", details: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const { code, orderTotal } = parsed.data;

    // Fetch promo code from Sanity
    try {
        const promo = await client.fetch(
            `*[_type == "promoCode" && code == $code][0]{
        code, type, value, minOrderAmount, maxUses, usedCount, isActive, expiresAt
      }`,
            { code }
        );

        if (!promo) {
            return NextResponse.json(
                { valid: false, error: "Промокод не найден" },
                { status: 404 }
            );
        }

        // Check active
        if (!promo.isActive) {
            return NextResponse.json(
                { valid: false, error: "Промокод неактивен" },
                { status: 400 }
            );
        }

        // Check expiry
        if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
            return NextResponse.json(
                { valid: false, error: "Промокод истёк" },
                { status: 400 }
            );
        }

        // Check usage limit
        if (promo.maxUses && promo.maxUses > 0 && (promo.usedCount || 0) >= promo.maxUses) {
            return NextResponse.json(
                { valid: false, error: "Промокод исчерпан" },
                { status: 400 }
            );
        }

        // Check min order amount
        if (promo.minOrderAmount && orderTotal && orderTotal < promo.minOrderAmount) {
            return NextResponse.json(
                {
                    valid: false,
                    error: `Минимальная сумма заказа: ${promo.minOrderAmount.toLocaleString()} сўм`,
                },
                { status: 400 }
            );
        }

        // Calculate discount
        let discount = 0;
        if (promo.type === "percentage" && orderTotal) {
            discount = Math.round(orderTotal * (promo.value / 100));
        } else if (promo.type === "fixed") {
            discount = promo.value;
        }

        return NextResponse.json({
            valid: true,
            code: promo.code,
            type: promo.type,
            value: promo.value,
            discount,
        });
    } catch (error) {
        console.error("[promo/validate] Sanity error:", error);
        return NextResponse.json(
            { valid: false, error: "Ошибка сервера" },
            { status: 500 }
        );
    }
}
