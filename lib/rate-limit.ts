/**
 * Simple in-memory rate limiter.
 *
 * Replace with @upstash/ratelimit + Redis for production multi-instance
 * deployments. This works well for single-server / serverless cold-start.
 */

interface RateLimitOptions {
    /** Time window in milliseconds */
    interval: number;
    /** Max unique tokens tracked (prevents memory leak) */
    uniqueTokenPerInterval: number;
}

interface RateLimitResult {
    /** Whether the request is allowed */
    success: boolean;
    /** Requests remaining in this window */
    remaining: number;
    /** Unix timestamp (ms) when the window resets */
    reset: number;
}

export function rateLimit(options: RateLimitOptions) {
    const { interval, uniqueTokenPerInterval } = options;
    const tokenCounts = new Map<string, { count: number; resetAt: number }>();

    // Periodic cleanup to prevent memory leaks
    const cleanup = () => {
        const now = Date.now();
        for (const [key, value] of tokenCounts) {
            if (now >= value.resetAt) {
                tokenCounts.delete(key);
            }
        }
        // Evict oldest entries if over capacity
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
        /**
         * Check if a request should be allowed.
         * @param limit  Max requests per interval
         * @param token  Unique identifier (e.g. IP address)
         */
        check(limit: number, token: string): RateLimitResult {
            cleanup();

            const now = Date.now();
            const entry = tokenCounts.get(token);

            if (!entry || now >= entry.resetAt) {
                // New window
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
