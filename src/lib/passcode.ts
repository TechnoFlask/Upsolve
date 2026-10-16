import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Format: scrypt:<salt hex>:<hash hex>
// No "$": Next.js expands "$NAME" inside .env files, which would corrupt the value.
export function hashPasscode(passcode: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(passcode, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPasscode(passcode: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(passcode, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}
