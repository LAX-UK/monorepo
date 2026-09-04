import { APIError } from "better-auth/api";
import type { AccountLinkReader } from "./ports/account-link-reader.js";
import type { EmailSender } from "./ports/email-sender.js";

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

export async function notifySocialAccountChange(options: {
  accounts: AccountLinkReader;
  email?: EmailSender | undefined;
  userId: string;
  providerId: string;
  template: "social-account-linked" | "social-account-unlinked";
}) {
  const { accounts, email, userId, providerId, template } = options;
  if (!email || !isSocialLinkProvider(providerId)) return;
  const userRow = await accounts.findUserEmailProfile(userId);
  if (!userRow) return;
  await email.enqueue({
    template,
    to: userRow.email,
    userId,
    category: "auth",
    vars: {
      userName: userRow.name,
      providerName: providerId === "google" ? "Google" : "Apple",
    },
  });
}
