/**
 * Rate limiter with Upstash Redis backend (distributed) and in-memory fallback.
 */

interface RateLimitOptions {
  interval: number;
  uniqueTokenPerInterval: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

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

function createUpstashLimiter({ interval }: RateLimitOptions) {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;

  async function redis(cmd: (string | number)[]): Promise<unknown> {
    const res = await fetch(`${url}/${cmd.map((c) => encodeURIComponent(String(c))).join("/")}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Upstash error: ${res.status}`);
    const data = (await res.json()) as { result: unknown };
    return data.result;
  }

  return {
    async check(limit: number, tokenKey: string): Promise<RateLimitResult> {
      const windowSec = Math.ceil(interval / 1000);
      const key = `ratelimit:${tokenKey}`;

      try {
        const count = (await redis(["INCR", key])) as number;
        if (count === 1) {
          await redis(["EXPIRE", key, windowSec]);
        }
        const ttl = (await redis(["TTL", key])) as number;
        const reset = Date.now() + (ttl > 0 ? ttl * 1000 : interval);

        if (count > limit) {
          return { success: false, remaining: 0, reset };
        }
        return { success: true, remaining: limit - count, reset };
      } catch (err) {
        console.error("Rate limit Redis error:", err);
        return { success: true, remaining: limit, reset: Date.now() + interval };
      }
    },
  };
}

const useUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

export function rateLimit(options: RateLimitOptions) {
  if (useUpstash) {
    return createUpstashLimiter(options);
  }
  return createMemoryLimiter(options);
}
