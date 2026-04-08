// Sentry configuration for the browser (Telegram WebApp).
// Loaded automatically by @sentry/nextjs.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    environment: process.env.NODE_ENV,
    // Filter noise
    ignoreErrors: [
      "ResizeObserver loop",
      "Non-Error promise rejection captured",
    ],
  });
}
