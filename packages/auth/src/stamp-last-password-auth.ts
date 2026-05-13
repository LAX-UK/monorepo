import type { Database } from "@auction/db";
import { session } from "@auction/db/schema";
import { eq } from "drizzle-orm";

/** Reads `Set-Cookie` from a Better Auth sign-in response and stamps `last_password_auth_at` on that session row. */
export async function stampLastPasswordAuthFromSignInResponse(
  authDb: Database,
  res: Response,
): Promise<void> {
  const cookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie().join(",")
      : (res.headers.get("set-cookie") ?? "");
  if (!cookies) return;
  const m = /(?:^|,)(?:\s*)(?:__Secure-)?better-auth\.session_token=([^;,]+)/.exec(cookies);
  if (!m?.[1]) return;
  let token: string;
  try {
    token = decodeURIComponent(m[1].trim());
  } catch {
    token = m[1].trim();
  }
  if (!token) return;
  const now = new Date();
  await authDb
    .update(session)
    .set({ lastPasswordAuthAt: now, updatedAt: now })
    .where(eq(session.token, token));
}
