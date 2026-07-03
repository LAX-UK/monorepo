import type { Database } from "@auction/db";
import { account as accountTable } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import { APIError } from "better-auth/api";
import { count, eq } from "drizzle-orm";

type SocialLinkProvider = "google" | "apple";

function isSocialLinkProvider(providerId: string): providerId is SocialLinkProvider {
  return providerId === "google" || providerId === "apple";
}

/** Sign-up creates the user row and the first social account row back-to-back
 * within the same request; a gap larger than this means it is a later link. */
export const SOCIAL_ACCOUNT_LINK_SIGNUP_THRESHOLD_MS = 5_000;

/** True when a social account row represents a later link, not initial sign-up. */
export function shouldNotifySocialAccountLinked(options: {
  userCreatedAt: Date | string;
  accountCreatedAt: Date | string;
}): boolean {
  const userMs = new Date(options.userCreatedAt).getTime();
  const accountMs = new Date(options.accountCreatedAt).getTime();
  if (!Number.isFinite(userMs) || !Number.isFinite(accountMs)) return false;
  return accountMs - userMs > SOCIAL_ACCOUNT_LINK_SIGNUP_THRESHOLD_MS;
}

/** Block removing the last account row when verified email (magic link) is not available. */
export async function shouldBlockLastAccountUnlink(options: {
  db: Database;
  userId: string;
  accountRowsForUser: number;
}): Promise<boolean> {
  if (options.accountRowsForUser > 1) return false;
  const userRow = await options.db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, options.userId),
    columns: { emailVerified: true },
  });
  if (!userRow) return true;
  return userRow.emailVerified !== true;
}

/**
 * Guard for `databaseHooks.account.delete.before`. Throws (rather than
 * returning `false`) when unlinking would remove the user's last sign-in
 * method: Better Auth's `deleteWithHooks` silently no-ops on a `false` return
 * and `/unlink-account` still reports `{ status: true }`, so a `false` return
 * would leave the account linked while telling the client it was removed.
 */
export async function assertCanUnlinkAccount(options: {
  db: Database;
  userId: string;
}): Promise<void> {
  const countResult = await options.db
    .select({ value: count() })
    .from(accountTable)
    .where(eq(accountTable.userId, options.userId));
  const accountRowsForUser = countResult[0]?.value ?? 0;
  const block = await shouldBlockLastAccountUnlink({
    db: options.db,
    userId: options.userId,
    accountRowsForUser,
  });
  if (block) {
    throw new APIError("BAD_REQUEST", {
      message: "You need at least one sign-in method on your account.",
      code: "FAILED_TO_UNLINK_LAST_ACCOUNT",
    });
  }
}

export async function notifySocialAccountChange(options: {
  db: Database;
  email?: IEmailService | undefined;
  userId: string;
  providerId: string;
  template: "social-account-linked" | "social-account-unlinked";
}) {
  const { db, email, userId, providerId, template } = options;
  if (!email || !isSocialLinkProvider(providerId)) return;
  const userRow = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
    columns: { email: true, name: true },
  });
  if (!userRow) return;
  email
    .enqueue({
      template,
      to: userRow.email,
      userId,
      category: "auth",
      vars: { provider: providerId, userName: userRow.name },
    })
    .catch((err: unknown) => {
      console.error(`[auth] enqueue ${template} failed`, {
        userId,
        providerId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
}
