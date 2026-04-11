/**
 * Rate limiter with Upstash Redis backend (distributed) and in-memory fallback.
 *
 * Uses Upstash if UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set —
 * required for Vercel serverless (multiple instances share no state).
 *
 * Falls back to in-memory for dev or single-process deployments.
 */

interface RateLimitOptions {
  /** Time window in milliseconds */
  interval: number;
  /** Max unique tokens tracked (memory leak protection, in-memory only) */
  uniqueTokenPerInterval: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

// ── In-memory fallback ─────────────────────────────────────────

function createMemoryLimiter({ interval, uniqueTokenPerInterval }: RateLimitOptions) {
  const tokenCounts = new Map<string, { count: number; resetAt: number }>();

  const cleanup = () => {
    const now = Date.now();
    for (const [key, value] of tokenCounts) {
      if (now >= value.resetAt) tokenCounts.delete(key);
    }
    if (tokenCounts.size > uniqueTokenPerInterval) {
      const excess = tokenCounts.size - uniqueTokenPerInterval;
      const keys = tokenCounts.keys();
      for (let i = 0; i < excess; i++) {
        const { value } = keys.next();
        if (value) tokenCounts.delete(value);
      }
    }
  };

  return {
    async check(limit: number, token: string): Promise<RateLimitResult> {
      cleanup();
      const now = Date.now();
      const entry = tokenCounts.get(token);

      if (!entry || now >= entry.resetAt) {
        const resetAt = now + interval;
        tokenCounts.set(token, { count: 1, resetAt });
        return { success: true, remaining: limit - 1, reset: resetAt };
      }

      if (entry.count >= limit) {
        return { success: false, remaining: 0, reset: entry.resetAt };
      }

      entry.count++;
      return {
        success: true,
        remaining: limit - entry.count,
        reset: entry.resetAt,
      };
    },
  };
}

// ── Upstash implementation (via REST API — no extra deps) ─────

function createUpstashLimiter({ interval }: RateLimitOptions) {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;

  async function redis(cmd: (string | number)[]): Promise<unknown> {
    const res = await fetch(`${url}/${cmd.map((c) => encodeURIComponent(String(c))).join("/")}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstash error: ${res.status}`);
    const data = await res.json();
    return data.result;
  }

  return {
    async check(limit: number, tokenKey: string): Promise<RateLimitResult> {
      const windowSec = Math.ceil(interval / 1000);
      const key = `ratelimit:${tokenKey}`;

      try {
        // INCR counter
        const count = (await redis(["INCR", key])) as number;

        // Set TTL only on first increment
        if (count === 1) {
          await redis(["EXPIRE", key, windowSec]);
        }

        // Get remaining TTL for reset time
        const ttl = (await redis(["TTL", key])) as number;
        const reset = Date.now() + (ttl > 0 ? ttl * 1000 : interval);

        if (count > limit) {
          return { success: false, remaining: 0, reset };
        }
        return { success: true, remaining: limit - count, reset };
      } catch (err) {
        // Fail open on Redis error — don't block legitimate users
        console.error("Rate limit Redis error:", err);
        return { success: true, remaining: limit, reset: Date.now() + interval };
      }
    },
  };
}

// ── Factory ────────────────────────────────────────────────────

const useUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

export function rateLimit(options: RateLimitOptions) {
  if (useUpstash) {
    return createUpstashLimiter(options);
  }
  return createMemoryLimiter(options);
}
