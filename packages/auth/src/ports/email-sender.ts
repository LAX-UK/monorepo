/** Identity-owned email port implemented outside the issuer boundary. */

export const IDENTITY_EMAIL_TEMPLATE_NAMES = [
  "account-suspended",
  "welcome",
  "verify-email",
  "account-activation",
  "sign-in-link",
  "reset-password",
  "oauth-account-reset-attempt",
  "password-changed",
  "2fa-enabled",
  "2fa-disabled",
  "2fa-reset-by-support",
  "backup-codes-regenerated",
  "email-changed",
  "phone-verified",
  "phone-removed",
  "social-account-linked",
  "social-account-unlinked",
  "new-device-login",
  "password-changed-elsewhere",
  "password-changed-sessions-not-revoked",
  "change-email",
  "account-deletion-requested",
  "account-deletion-cancelled",
  "data-export-requested",
  "data-export-ready",
  "account-deletion-reminder",
  "account-deletion-held",
  "account-deletion-completed",
] as const;

export type IdentityEmailTemplate = (typeof IDENTITY_EMAIL_TEMPLATE_NAMES)[number];

export type EmailCategory = "auth" | "transactional";
export type EmailStream = "transactional" | "broadcast";

export type EmailEnqueueInput = {
  template: IdentityEmailTemplate;
  to: string;
  userId?: string;
  vars: Record<string, unknown>;
  stream?: EmailStream;
  idempotencyKey?: string;
  category: EmailCategory;
};

export type EmailSender = {
  enqueue(input: EmailEnqueueInput): Promise<{ outboxId: string }>;
};

/**
 * An email that carries a one-time link (verification, password reset, sign-in link).
 * `idempotencyKey` is required: it is what lets a retry reach the same queued message
 * instead of sending a second link.
 */
export type CredentialEmailInput = EmailEnqueueInput & { idempotencyKey: string };

/**
 * Hands over a credential email. Resolves once the message is queued or durably recorded for
 * retry, and rejects only when neither happened, so the caller can tell the person it was not sent.
 */
export type CredentialEmailSender = {
  send(input: CredentialEmailInput): Promise<void>;
};
