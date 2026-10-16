import { createHmac, timingSafeEqual } from "node:crypto";

// Cookie value: "<expiresAtMs>.<base64url HMAC-SHA256 of expiresAtMs>"
export const SESSION_COOKIE = "upsolve_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET must be set (32+ chars). Run `bun hash-passcode`.");
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(now = Date.now()): string {
  const expiresAt = String(now + SESSION_MAX_AGE_SECONDS * 1000);
  return `${expiresAt}.${sign(expiresAt)}`;
}

export function isValidSessionToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature) return false;
  const expected = Buffer.from(sign(expiresAt));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
  return Number(expiresAt) > now;
}
