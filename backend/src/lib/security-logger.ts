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

export function logSecurityEvent(event: Omit<SecurityEvent, "timestamp">) {
  const entry: SecurityEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  console.warn(`[SECURITY] [${entry.type}]`, JSON.stringify(entry));
}
