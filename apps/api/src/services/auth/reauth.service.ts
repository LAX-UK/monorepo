import type { Database } from "@auction/db";
import { account, session } from "@auction/db/schema";
import { verifyPassword } from "@better-auth/utils/password";
import { and, eq } from "drizzle-orm";

/** Re-prove password for the current cookie session and stamp `last_password_auth_at`. */
export async function stampReauthWithPassword(opts: {
  authDb: Database;
  userId: string;
  password: string;
  sessionTokenFromCookie: string | null;
}): Promise<"ok" | "invalid_password" | "no_session" | "no_credential"> {
  if (!opts.sessionTokenFromCookie) return "no_session";
  const [acct] = await opts.authDb
    .select({ password: account.password })
    .from(account)
    .where(and(eq(account.userId, opts.userId), eq(account.providerId, "credential")))
    .limit(1);
  if (!acct?.password) return "no_credential";
  const match = await verifyPassword(acct.password, opts.password);
  if (!match) return "invalid_password";
  const now = new Date();
  const updated = await opts.authDb
    .update(session)
    .set({ lastPasswordAuthAt: now, updatedAt: now })
    .where(and(eq(session.userId, opts.userId), eq(session.token, opts.sessionTokenFromCookie)))
    .returning({ id: session.id });
  if (updated.length === 0) return "no_session";
  return "ok";
}
