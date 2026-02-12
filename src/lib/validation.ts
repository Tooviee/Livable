/**
 * Shared validation and security limits for request data.
 * Keeps stored data bounded and prevents abuse.
 */

export const LIMITS = {
  name: 200,
  email: 320,
  phone: 50,
  language: 50,
  category: 100,
  message: 10_000,
  internal_notes: 5_000,
} as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidEmail(s: string): boolean {
  return s.length <= LIMITS.email && EMAIL_REGEX.test(s);
}

export function isValidUuid(s: string): boolean {
  return UUID_REGEX.test(s);
}

export function trimToMax(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, max) : t;
}

export function validateLengths(parsed: {
  name: string;
  email: string;
  phone: string | null;
  language: string;
  category: string;
  message: string;
}): { ok: true; data: typeof parsed } | { ok: false; error: string } {
  if (parsed.name.length > LIMITS.name) {
    return { ok: false, error: `Name must be ${LIMITS.name} characters or less.` };
  }
  if (!isValidEmail(parsed.email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (parsed.phone && parsed.phone.length > LIMITS.phone) {
    return { ok: false, error: `Phone must be ${LIMITS.phone} characters or less.` };
  }
  if (parsed.language.length > LIMITS.language) {
    return { ok: false, error: `Language must be ${LIMITS.language} characters or less.` };
  }
  if (parsed.category.length > LIMITS.category) {
    return { ok: false, error: `Category must be ${LIMITS.category} characters or less.` };
  }
  if (parsed.message.length > LIMITS.message) {
    return { ok: false, error: `Message must be ${LIMITS.message} characters or less.` };
  }
  return { ok: true, data: parsed };
}
