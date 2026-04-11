import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit } from "@backend/security/rate-limit";

// Ensure we use the in-memory branch (not Upstash)
beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe("rateLimit (in-memory)", () => {
  it("allows requests under the limit", async () => {
    const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100 });
    const r1 = await limiter.check(5, "user-1");
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(4);
  });

  it("rejects requests over the limit", async () => {
    const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100 });
    for (let i = 0; i < 3; i++) {
      await limiter.check(3, "user-2");
    }
    const blocked = await limiter.check(3, "user-2");
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("tracks different tokens independently", async () => {
    const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100 });
    await limiter.check(2, "user-a");
    await limiter.check(2, "user-a");
    const blockedA = await limiter.check(2, "user-a");
    expect(blockedA.success).toBe(false);

    const allowedB = await limiter.check(2, "user-b");
    expect(allowedB.success).toBe(true);
  });

  it("returns correct remaining count", async () => {
    const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100 });
    const r1 = await limiter.check(10, "user-3");
    const r2 = await limiter.check(10, "user-3");
    const r3 = await limiter.check(10, "user-3");
    expect(r1.remaining).toBe(9);
    expect(r2.remaining).toBe(8);
    expect(r3.remaining).toBe(7);
  });
});
