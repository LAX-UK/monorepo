import {
  type AccountContactError,
  type AccountContactResponse,
  type AccountEmailChangeConfirmedResponse,
  accountPhoneSchema,
} from "@auction/identity-contracts";
import type { AccountOverviewVm } from "./account-overview.vm";

/** The email and phone Personal details shows: live from the issuer, else as of sign-in. */
export type ProfileContactVm = {
  email: string | null;
  emailVerified: boolean;
  /** The address a change is waiting on, or null when none is in progress. */
  pendingEmail: string | null;
  phone: string | null;
  phoneVerified: boolean;
};

/**
 * An ID token only knows the contact details from sign-in, so a person who has just changed
 * their phone would still see the old one. The live answer wins; when the issuer cannot be
 * reached the page falls back to the token and shows no pending change, because it cannot know.
 */
export function resolveProfileContact(
  overview: Pick<AccountOverviewVm, "email" | "emailVerified" | "phone" | "phoneVerified">,
  live: AccountContactResponse | null,
): ProfileContactVm {
  return live
    ? {
        email: live.email,
        emailVerified: live.emailVerified,
        pendingEmail: live.pendingEmail,
        phone: live.phone,
        phoneVerified: live.phone !== null && live.phoneVerified,
      }
    : {
        email: overview.email,
        emailVerified: overview.emailVerified,
        pendingEmail: null,
        phone: overview.phone,
        phoneVerified: overview.phoneVerified,
      };
}

/**
 * Turns what a person typed into the E.164 number the issuer verifies, or null when it is not
 * one. A country code is required: guessing one would send a code to the wrong person's phone.
 */
export function normalisePhoneInput(raw: string): string | null {
  // "+44 (0) 7700 ..." shows the trunk zero that is dropped when dialling from abroad.
  const compact = raw.replace(/\(0\)/g, "").replace(/[\s().-]/g, "");
  const international = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  const parsed = accountPhoneSchema.safeParse(international);
  return parsed.success ? parsed.data : null;
}

/** The one action offered for the phone: a number on file but unverified is verified in place. */
export function phoneEntryLabel(phone: string | null, phoneVerified: boolean): string {
  if (!phone) return "Add phone number";
  return phoneVerified ? "Change phone number" : "Verify phone number";
}

const REJECTION_MESSAGES: Record<AccountContactError, string> = {
  email_taken: "That email address is already used by another LAX account.",
  same_email: "That is already your email address.",
  none_in_progress: "There is no email change waiting to be confirmed.",
  invalid_token: "This link isn't valid. Start the change again from Personal details.",
  stale_flow:
    "This link is out of date because the change was cancelled or replaced. Start again from Personal details.",
  expired: "This link has expired. Start the change again from Personal details.",
  phone_taken: "That phone number is already used by another LAX account.",
  invalid_phone:
    "That doesn't look like a valid phone number. Include your country code, for example +44 7700 900123.",
  invalid_code: "That code isn't right. Check the message and try again.",
  rate_limited: "Too many attempts. Wait a few minutes and try again.",
};

export function contactRejectionMessage(reason: AccountContactError): string {
  return REJECTION_MESSAGES[reason];
}

export type EmailChangeConfirmationVm = {
  heading: string;
  body: string;
  /** True once the address has switched: every sign-in was ended, so the person must sign in again. */
  signInAgain: boolean;
};

/** What the page behind an emailed confirmation link tells the person after they confirm. */
export function buildEmailChangeConfirmationVm(
  result: AccountEmailChangeConfirmedResponse,
): EmailChangeConfirmationVm {
  if (result.completed) {
    return {
      heading: "Your email address has changed",
      body: "Both addresses are confirmed. For your security we've signed you out of LAX everywhere. Sign in again with your new email address.",
      signInAgain: true,
    };
  }
  const other = result.confirmedFor === "old" ? "your new address" : "your current address";
  return {
    heading: "One more step",
    body: `Thank you, this address is confirmed. Open the email we sent to ${other} and confirm there to finish the change.`,
    signInAgain: false,
  };
}
