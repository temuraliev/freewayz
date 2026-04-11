import "server-only";

import { NextRequest } from "next/server";

/**
 * Allowed origins for API routes.
 *
 * In production, replace with your actual domain(s).
 * Telegram WebApps run inside an iframe on web.telegram.org,
 * but the fetch origin will be your own domain.
 */
const ALLOWED_ORIGINS: Set<string> = new Set([
    // Add your production domain here (it will be set dynamically below)
]);

/**
 * Check the Origin / Referer header to prevent cross-site request forgery.
 *
 * Returns the offending origin string if blocked, or null if allowed.
 */
export function checkCsrf(request: NextRequest): string | null {
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");

    // In development, allow all origins
    if (process.env.NODE_ENV === "development") {
        return null;
    }

    // Build allowed origins dynamically from the request host
    const host = request.headers.get("host");
    if (host) {
        ALLOWED_ORIGINS.add(`https://${host}`);
        ALLOWED_ORIGINS.add(`http://${host}`); // for local dev behind proxy
    }

    // Also allow the VERCEL_URL if set
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) {
        ALLOWED_ORIGINS.add(`https://${vercelUrl}`);
    }

    // Check origin header first
    if (origin) {
        if (ALLOWED_ORIGINS.has(origin)) {
            return null; // allowed
        }
        return origin; // blocked
    }

    // Fallback to referer header
    if (referer) {
        try {
            const refererOrigin = new URL(referer).origin;
            if (ALLOWED_ORIGINS.has(refererOrigin)) {
                return null;
            }
            return refererOrigin;
        } catch {
            return referer;
        }
    }

    // No origin or referer — could be a server-to-server call or curl.
    // Block by default in production for state-changing endpoints.
    return "missing-origin";
}
