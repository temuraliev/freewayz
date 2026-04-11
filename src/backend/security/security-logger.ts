import "server-only";

type SecurityEventType =
    | "AUTH_FAILED"
    | "AUTH_SUCCESS"
    | "RATE_LIMITED"
    | "VALIDATION_FAILED"
    | "CSRF_BLOCKED"
    | "CHECKOUT_PRICE_MISMATCH";

interface SecurityEvent {
    type: SecurityEventType;
    ip: string;
    detail?: string;
    timestamp: string;
}

/**
 * Log security-relevant events.
 *
 * In production, replace console.warn with your logging service
 * (e.g. Sentry, Datadog, Axiom, or a webhook).
 */
export function logSecurityEvent(event: Omit<SecurityEvent, "timestamp">) {
    const entry: SecurityEvent = {
        ...event,
        timestamp: new Date().toISOString(),
    };

    // Color-coded console output for visibility
    console.warn(`[SECURITY] [${entry.type}]`, JSON.stringify(entry));
}
