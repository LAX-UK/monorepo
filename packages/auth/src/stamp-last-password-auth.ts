import type { SessionStampStore } from "./ports/session-stamp-store.js";

function readSessionToken(res: Response): string | null {
  const cookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie().join(",")
      : (res.headers.get("set-cookie") ?? "");
  if (!cookies) return null;
  const m = /(?:^|,)(?:\s*)(?:__Secure-)?better-auth\.session_token=([^;,]+)/.exec(cookies);
  if (!m?.[1]) return null;
  let token: string;
  try {
    token = decodeURIComponent(m[1].trim());
  } catch {
    token = m[1].trim();
  }
  if (!token) return null;
  return token;
}

/** Reads `Set-Cookie` from a Better Auth sign-in response and stamps `last_password_auth_at`. */
export async function stampLastPasswordAuthFromSignInResponse(
  store: SessionStampStore,
  res: Response,
): Promise<void> {
  const token = readSessionToken(res);
  if (!token) return;
  await store.stampPasswordAuth(token, new Date());
}

/** Records successful TOTP/backup-code completion against the exact new browser session. */
export async function stampMfaCompletedFromResponse(
  store: SessionStampStore,
  res: Response,
): Promise<void> {
  const token = readSessionToken(res);
  if (!token) return;
  await store.stampMfaCompleted(token, new Date());
}
