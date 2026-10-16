// Usage: bun hash-passcode "<your passcode>"
// Prints a value for UPSOLVE_PASSCODE_HASH and a fresh AUTH_SECRET.
import { randomBytes } from "node:crypto";
import { hashPasscode } from "../src/lib/passcode";

const passcode = process.argv[2];
if (!passcode || passcode.length < 12) {
  console.error('Usage: bun hash-passcode "<passcode of at least 12 characters>"');
  process.exit(1);
}

console.log(`UPSOLVE_PASSCODE_HASH=${hashPasscode(passcode)}`);
console.log(`AUTH_SECRET=${randomBytes(32).toString("base64url")}`);
