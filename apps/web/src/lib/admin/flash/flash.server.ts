import "server-only";

import { createHmac } from "node:crypto";
import { bffSecretKeyMaterial } from "@/lib/bff/config.server";
import { bidSessionCookieUsesSecureTransport } from "@/lib/bff/session-cookie.constants";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clearAdminFlash, readAdminFlash, writeAdminFlash } from "./flash-cookie";
import type { AdminFlash, AdminFlashKind } from "./flash-token";

/** Keeps this use of the server's signing secret apart from every other use of it. */
const KEY_CONTEXT = "lax-bid:admin-flash:v1";

function flashKey(): Buffer {
  return createHmac("sha256", bffSecretKeyMaterial()).update(KEY_CONTEXT).digest();
}

function env() {
  return { key: flashKey(), nowMs: Date.now(), secure: bidSessionCookieUsesSecureTransport() };
}

/**
 * Leaves a message for the page at `path` and sends the staff member there. The words travel in a
 * signed one-minute cookie, never in the URL.
 */
export async function redirectWithAdminFlash(
  path: string,
  kind: AdminFlashKind,
  message: string,
): Promise<never> {
  writeAdminFlash(await cookies(), env(), { kind, message, path });
  redirect(path);
}

/** The message waiting for this page, if any. Reading does not remove it; see `dropAdminFlash`. */
export async function readAdminFlashForPath(path: string): Promise<AdminFlash | null> {
  return readAdminFlash(await cookies(), env(), path);
}

/** Removes the message stored for `path`. Only a route handler or action may call this. */
export async function dropAdminFlash(path: string): Promise<boolean> {
  return clearAdminFlash(await cookies(), env(), path);
}
