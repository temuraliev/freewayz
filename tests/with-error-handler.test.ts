import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  withErrorHandler,
  ApiError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
} from "@backend/middleware/with-error-handler";

function makeRequest(): NextRequest {
  return {
    method: "GET",
    nextUrl: { pathname: "/api/test" },
  } as unknown as NextRequest;
}

describe("withErrorHandler", () => {
  it("passes through successful responses", async () => {
    const handler = withErrorHandler(async () =>
      NextResponse.json({ ok: true })
    );
    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("converts NotFoundError to 404", async () => {
    const handler = withErrorHandler(async () => {
      throw new NotFoundError("Widget not found");
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
    expect(body.error).toBe("Widget not found");
  });

  it("converts ValidationError to 400", async () => {
    const handler = withErrorHandler(async () => {
      throw new ValidationError("Bad input");
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("converts UnauthorizedError to 401", async () => {
    const handler = withErrorHandler(async () => {
      throw new UnauthorizedError();
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(401);
  });

  it("preserves custom ApiError status/code", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withErrorHandler(async () => {
      throw new ApiError("Conflict", 409, "CONFLICT");
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("CONFLICT");
  });

  it("converts unknown errors to 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withErrorHandler(async () => {
      throw new Error("db down");
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});
