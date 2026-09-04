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
  "social-account-linked",
  "social-account-unlinked",
  "new-device-login",
  "password-changed-elsewhere",
  "password-changed-sessions-not-revoked",
  "change-email",
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
