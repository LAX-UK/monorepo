import { z } from "zod";

/** Issuer routes LAX Account calls (under the Better Auth base path) for email and phone. */
export const ACCOUNT_CONTACT_PATH = "/lax/account-contact";
export const ACCOUNT_EMAIL_CHANGE_PATH = "/lax/account-email-change";
export const ACCOUNT_EMAIL_CHANGE_CANCEL_PATH = "/lax/account-email-change/cancel";
export const ACCOUNT_EMAIL_CHANGE_CONFIRM_PATH = "/lax/account-email-change/confirm";
export const ACCOUNT_PHONE_SEND_CODE_PATH = "/lax/account-phone/send-code";
export const ACCOUNT_PHONE_VERIFY_PATH = "/lax/account-phone/verify";

/** Length of the SMS code the verification provider sends. */
export const ACCOUNT_PHONE_CODE_LENGTH = 6;

/** A phone number in E.164 form. The issuer stores and verifies numbers only in this form. */
export const accountPhoneSchema = z.string().regex(/^\+[1-9]\d{6,14}$/);

export const accountPhoneCodeSchema = z
  .string()
  .regex(new RegExp(`^\\d{${ACCOUNT_PHONE_CODE_LENGTH}}$`));

export const accountEmailSchema = z.string().trim().toLowerCase().email().max(254);

/** What the person has on file, live (an ID token only knows the values from sign-in). */
export const accountContactSchema = z.object({
  email: z.string(),
  emailVerified: z.boolean(),
  /** The address a change is waiting on, or null when no change is in progress. */
  pendingEmail: z.string().nullable(),
  phone: z.string().nullable(),
  phoneVerified: z.boolean(),
});

export const accountEmailChangeStartedSchema = z.object({ pendingEmail: z.string() });

export const accountEmailChangeCancelledSchema = z.object({ cancelled: z.literal(true) });

/**
 * Both inboxes must confirm before the address switches. `completed` is false after the first
 * confirmation; `confirmedFor` says which inbox just did so.
 */
export const accountEmailChangeConfirmedSchema = z.object({
  completed: z.boolean(),
  confirmedFor: z.enum(["old", "new"]),
});

export const accountPhoneCodeSentSchema = z.object({ sent: z.literal(true) });

export const accountPhoneVerifiedSchema = z.object({
  phone: z.string(),
  verified: z.literal(true),
});

/** Reasons the issuer refuses an email or phone change, returned as `{ error }` (HTTP 400, 409, 422 or 429). */
export const ACCOUNT_CONTACT_ERRORS = [
  "email_taken",
  "same_email",
  "none_in_progress",
  "invalid_token",
  "stale_flow",
  "expired",
  "phone_taken",
  "invalid_phone",
  "invalid_code",
  "rate_limited",
] as const;

export type AccountContactError = (typeof ACCOUNT_CONTACT_ERRORS)[number];
export type AccountContactResponse = z.infer<typeof accountContactSchema>;
export type AccountEmailChangeConfirmedResponse = z.infer<typeof accountEmailChangeConfirmedSchema>;
