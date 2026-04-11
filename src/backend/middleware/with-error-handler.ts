import { NextRequest, NextResponse } from "next/server";

// Log errors for observability. Sentry integration can be added here
// once @sentry/nextjs supports Next.js 16.
function captureException(error: unknown, context: Record<string, unknown>) {
  // In production, errors are already logged to console.error below.
  // This function is a hook point for future error tracking services.
  void error;
  void context;
}

// Next.js 16: route handler context.params is a Promise<...>
// Use a permissive type so individual handlers can narrow params via generics.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (req: NextRequest, ctx: any) => Promise<NextResponse>;

interface ErrorResponse {
  error: string;
  code: string;
}

/**
 * Wraps a Next.js route handler with consistent error handling.
 * Catches errors and returns structured JSON responses.
 */
export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      // Handle ApiError subclasses with explicit status/code
      if (error instanceof ApiError) {
        console.error(`[API Error ${error.statusCode}] ${req.method} ${req.nextUrl.pathname}:`, error.message);
        return NextResponse.json<ErrorResponse>(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        );
      }

      // Handle Zod validation errors
      if (error && typeof error === "object" && "issues" in error) {
        const zodError = error as { issues: unknown[] };
        console.error(`[Validation Error] ${req.method} ${req.nextUrl.pathname}:`, zodError.issues);
        return NextResponse.json<ErrorResponse>(
          { error: "Validation failed", code: "VALIDATION_ERROR" },
          { status: 400 }
        );
      }

      // Unknown errors — send to Sentry
      const message = error instanceof Error ? error.message : "Internal server error";
      console.error(`[API Error] ${req.method} ${req.nextUrl.pathname}:`, error);
      await captureException(error, {
        method: req.method,
        path: req.nextUrl.pathname,
      });

      return NextResponse.json<ErrorResponse>(
        { error: message, code: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }
  };
}

/**
 * Custom error classes for structured error handling.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR"
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ValidationError extends ApiError {
  constructor(message = "Validation failed") {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}
