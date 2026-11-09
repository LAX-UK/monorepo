import { APIError } from "better-auth/api";
import type { AccountLinkReader } from "./ports/account-link-reader.js";
import type { IdentityEventPublisher } from "./ports/identity-event-publisher.js";
import type { SecurityNoticePublisher } from "./ports/security-notice.js";

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
  accounts: AccountLinkReader;
  userId: string;
  accountRowsForUser: number;
}): Promise<boolean> {
  if (options.accountRowsForUser > 1) return false;
  const emailVerified = await options.accounts.isEmailVerified(options.userId);
  if (emailVerified === null) return true;
  return emailVerified !== true;
}

export async function assertCanUnlinkAccount(options: {
  accounts: AccountLinkReader;
  userId: string;
}): Promise<void> {
  const accountRowsForUser = await options.accounts.countAccountsForUser(options.userId);
  const block = await shouldBlockLastAccountUnlink({
    accounts: options.accounts,
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

/**
 * Records that a Google or Apple sign-in was added to or removed from an account: one audit event
 * and the one security email ("a way to sign in was added or removed"). Neither can undo or block
 * the change, so a failure to record or send either is swallowed.
 */
export async function recordSignInMethodChange(options: {
  notices?: SecurityNoticePublisher | undefined;
  events?: IdentityEventPublisher | undefined;
  userId: string;
  providerId: string;
  change: "added" | "removed";
  at?: Date;
  /** The address the provider reported, when it is known. */
  providerEmail?: string | null;
}) {
  const { notices, events, userId, providerId, change } = options;
  if (!isSocialLinkProvider(providerId)) return;
  try {
    await events?.publish({
      type: change === "added" ? "user.sign_in_method_added" : "user.sign_in_method_removed",
      userId,
      method: providerId,
    });
  } catch {
    // The change stands whether or not its record could be written.
  }
  await notices?.notify({
    kind: change === "added" ? "sign_in_method_added" : "sign_in_method_removed",
    userId,
    at: options.at ?? new Date(),
    method: providerId,
    detail: options.providerEmail ?? null,
  });
}
