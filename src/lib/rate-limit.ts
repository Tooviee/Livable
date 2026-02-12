/**
 * Simple in-memory rate limit for API routes.
 * Note: On serverless (e.g. Vercel), each instance has its own memory, so limits are per-instance.
 * For stricter limits across instances, use a shared store (e.g. Upstash Redis).
 */

const windowMs = 15 * 60 * 1000; // 15 minutes
const maxSubmitsPerWindow = 5;

const submitCounts = new Map<string, { count: number; resetAt: number }>();

function prune(): void {
  const now = Date.now();
  for (const key of Array.from(submitCounts.keys())) {
    const v = submitCounts.get(key);
    if (v && v.resetAt < now) submitCounts.delete(key);
  }
}

export function checkSubmitRateLimit(identifier: string): { ok: true } | { ok: false; retryAfter: number } {
  prune();
  const now = Date.now();
  const entry = submitCounts.get(identifier);
  if (!entry) {
    submitCounts.set(identifier, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (entry.resetAt < now) {
    submitCounts.set(identifier, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  entry.count += 1;
  if (entry.count > maxSubmitsPerWindow) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true };
}

export function getSubmitLimitMessage(retryAfterSeconds: number): string {
  return `Too many requests. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`;
}
