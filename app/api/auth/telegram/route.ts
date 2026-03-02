import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram-auth";
import { telegramInitDataSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { checkCsrf } from "@/lib/csrf";
import { logSecurityEvent } from "@/lib/security-logger";

// Rate limiter: 10 requests per 60 seconds per IP
const limiter = rateLimit({
    interval: 60_000,
    uniqueTokenPerInterval: 500,
});

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
    const { success, remaining, reset } = limiter.check(10, ip);

    if (!success) {
        logSecurityEvent({ type: "RATE_LIMITED", ip, detail: "/api/auth/telegram" });
        return NextResponse.json(
            { error: "Too many requests. Please try again later." },
            {
                status: 429,
                headers: {
                    "X-RateLimit-Remaining": String(remaining),
                    "X-RateLimit-Reset": String(reset),
                    "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
                },
            }
        );
    }

    // ── Validate body ───────────────────────────────────────────
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        );
    }

    const parsed = telegramInitDataSchema.safeParse(body);
    if (!parsed.success) {
        logSecurityEvent({
            type: "VALIDATION_FAILED",
            ip,
            detail: JSON.stringify(parsed.error.flatten()),
        });
        return NextResponse.json(
            { error: "initData is required", details: parsed.error.flatten() },
            { status: 400 }
        );
    }

    // ── Validate Telegram hash ──────────────────────────────────
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
        console.error("[auth/telegram] BOT_TOKEN is not set in environment");
        return NextResponse.json(
            { error: "Server configuration error" },
            { status: 500 }
        );
    }

    const result = validateTelegramInitData(parsed.data.initData, botToken);

    if (!result) {
        logSecurityEvent({ type: "AUTH_FAILED", ip, detail: "Invalid Telegram hash" });
        return NextResponse.json(
            { error: "Invalid or expired Telegram data" },
            { status: 401 }
        );
    }

    // ── Return verified user ────────────────────────────────────
    logSecurityEvent({
        type: "AUTH_SUCCESS",
        ip,
        detail: `user_id=${result.user.id}`,
    });

    return NextResponse.json(
        {
            ok: true,
            user: result.user,
            authDate: result.authDate,
        },
        {
            status: 200,
            headers: {
                "X-RateLimit-Remaining": String(remaining),
                "X-RateLimit-Reset": String(reset),
            },
        }
    );
}
