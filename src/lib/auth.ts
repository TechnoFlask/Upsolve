import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SESSION_COOKIE, isValidSessionToken } from "./session";

// Second line of defence behind src/proxy.ts: every server action and
// data-reading page calls this before touching the database.
export async function requireSession(): Promise<void> {
  // Session expiry compares against the current time, so never prerender this.
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!isValidSessionToken(token)) redirect("/unlock");
}
