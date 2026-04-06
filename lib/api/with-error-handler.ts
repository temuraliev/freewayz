import { NextRequest, NextResponse } from "next/server";

type RouteHandler = (
  req: NextRequest,
  ctx?: { params: Record<string, string> }
) => Promise<NextResponse>;

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
      const message =
        error instanceof Error ? error.message : "Internal server error";
      const code = getErrorCode(error);
      const status = getHttpStatus(error);

      console.error(`[API Error] ${req.method} ${req.nextUrl.pathname}:`, message);

      return NextResponse.json<ErrorResponse>(
        { error: message, code },
        { status }
      );
    }
  };
}

function getErrorCode(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("not found")) return "NOT_FOUND";
    if (error.message.includes("unauthorized")) return "UNAUTHORIZED";
    if (error.message.includes("validation")) return "VALIDATION_ERROR";
  }
  return "INTERNAL_ERROR";
}

function getHttpStatus(error: unknown): number {
  if (error instanceof Error) {
    if (error.message.includes("not found")) return 404;
    if (error.message.includes("unauthorized")) return 401;
    if (error.message.includes("validation")) return 400;
  }
  return 500;
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
