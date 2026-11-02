import type { EmailProductVars, TemplateDomainSlice } from "./shared.js";

const names = [
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
  "social-account-linked",
  "social-account-unlinked",
  "new-device-login",
  "password-changed-elsewhere",
  "password-changed-sessions-not-revoked",
  "change-email",
  "account-deletion-requested",
  "account-deletion-cancelled",
] as const;

type AuthTemplateName = (typeof names)[number];

/** What every LAX Account security notice states: when, on which device, and where to secure the account. */
type SecurityNoticeVars = {
  userName?: string | null;
  /** Europe/London time, formatted by the sender. */
  whenDisplay: string;
  /** Browser and system label; absent when the request carried no user agent. */
  deviceLabel?: string | null;
  secureAccountUrl: string;
};

type AuthTemplateVarsBase = {
  "account-suspended": {
    userName?: string | null;
    supportContactEmail: string;
  };
  welcome: {
    userName?: string | null;
  };
  "verify-email": {
    verificationUrl: string;
    userName?: string | null;
  };
  "account-activation": {
    activationUrl: string;
    userName?: string | null;
    expirationMinutes: number;
  };
  "sign-in-link": {
    signInUrl: string;
    userName?: string | null;
    expirationMinutes: number;
  };
  "reset-password": {
    resetLink: string;
    userEmail: string;
    userName?: string | null;
    expirationMinutes: number;
  };
  /** Sent when a forgot-password is requested for an account that exists
   * but has no credential row (i.e. was created via Google/Apple). The
   * privacy contract requires the public response to be identical to other
   * branches; tailored guidance is delivered only to the inbox owner.
   */
  "oauth-account-reset-attempt": {
    provider: "google" | "apple";
    signInUrl: string;
    settingsUrl: string;
    userEmail: string;
    userName?: string | null;
  };
  "password-changed": SecurityNoticeVars;
  "2fa-enabled": SecurityNoticeVars;
  "2fa-disabled": SecurityNoticeVars;
  "2fa-reset-by-support": SecurityNoticeVars;
  "backup-codes-regenerated": SecurityNoticeVars;
  "email-changed": SecurityNoticeVars & {
    previousEmail: string;
    newEmail: string;
    /** Which inbox received this message: the copy differs for the old and the new address. */
    recipient: "previous" | "new";
  };
  "phone-verified": SecurityNoticeVars & {
    /** Already masked, for example "+44 •••• 1234". */
    maskedPhone: string;
  };
  "social-account-linked": {
    provider: "google" | "apple";
    userName?: string | null;
  };
  "social-account-unlinked": {
    provider: "google" | "apple";
    userName?: string | null;
  };
  "new-device-login": SecurityNoticeVars;
  "password-changed-elsewhere": {
    userName?: string | null;
  };
  "password-changed-sessions-not-revoked": {
    userName?: string | null;
    sessionsSettingsUrl: string;
  };
  /** The grace period has started: says when the data is erased and how to stop it. */
  "account-deletion-requested": SecurityNoticeVars & {
    /** Day the grace period ends, formatted by the sender (Europe/London). */
    effectiveDateDisplay: string;
    /** Days between the request and erasure. */
    graceDays: number;
    /** LAX Account's "Delete your account" page, where the request can be cancelled. */
    cancelDeletionUrl: string;
  };
  "account-deletion-cancelled": SecurityNoticeVars;
  "change-email": {
    confirmationUrl: string;
    oldEmail: string;
    newEmail: string;
    userName?: string | null;
    /** Which inbox received this message — copy differs for current vs new address. */
    recipient: "current" | "new";
  };
};

/** Shared account mail may say which product the person is acting in; the footer then names its company. */
type AuthTemplateVars = { [K in AuthTemplateName]: AuthTemplateVarsBase[K] & EmailProductVars };

export const authTemplates = {
  names,
  vars: {} as AuthTemplateVars,
  recipientResolution: {
    "account-suspended": "live",
    welcome: "live",
    "verify-email": "live",
    "account-activation": "live",
    "sign-in-link": "live",
    "reset-password": "live",
    "oauth-account-reset-attempt": "live",
    "password-changed": "live",
    "2fa-enabled": "live",
    "2fa-disabled": "live",
    "2fa-reset-by-support": "live",
    "backup-codes-regenerated": "live",
    "email-changed": "snapshot",
    "phone-verified": "live",
    "social-account-linked": "live",
    "social-account-unlinked": "live",
    "new-device-login": "live",
    "password-changed-elsewhere": "live",
    "password-changed-sessions-not-revoked": "live",
    "change-email": "snapshot",
    "account-deletion-requested": "live",
    "account-deletion-cancelled": "live",
  },
} satisfies TemplateDomainSlice<AuthTemplateName, AuthTemplateVars>;

export type { AuthTemplateName, AuthTemplateVars };
