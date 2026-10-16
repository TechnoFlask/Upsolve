"use server";

import { and, eq, gte, lt, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";
import { verifyPasscode } from "@/lib/passcode";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
} from "@/lib/session";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

export type UnlockState = { error?: string };

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "/today";
  // Only same-site relative paths; blocks "//evil.com" and absolute URLs.
  return next.startsWith("/") && !next.startsWith("//") ? next : "/today";
}

export async function unlock(_prev: UnlockState, formData: FormData): Promise<UnlockState> {
  const stored = process.env.UPSOLVE_PASSCODE_HASH;
  if (!stored) return { error: "Server is missing UPSOLVE_PASSCODE_HASH." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const now = Date.now();
  const windowStart = new Date(now - WINDOW_MS);

  // Housekeeping: drop attempts older than the window.
  await db.delete(loginAttempts).where(lt(loginAttempts.at, windowStart));

  const [{ failures }] = await db
    .select({ failures: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.ip, ip), gte(loginAttempts.at, windowStart)));

  if (failures >= MAX_FAILURES) {
    return { error: "Too many wrong attempts. Try again in 15 minutes." };
  }

  const passcode = formData.get("passcode");
  if (typeof passcode !== "string" || !verifyPasscode(passcode, stored)) {
    await db.insert(loginAttempts).values({ ip, at: new Date(now) });
    const left = MAX_FAILURES - failures - 1;
    return { error: left > 0 ? `Wrong passcode. ${left} attempt${left === 1 ? "" : "s"} left.` : "Wrong passcode. Locked for 15 minutes." };
  }

  await db.delete(loginAttempts).where(eq(loginAttempts.ip, ip));
  (await cookies()).set(SESSION_COOKIE, createSessionToken(now), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect(safeNext(formData.get("next")));
}

export async function lock(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/unlock");
}
