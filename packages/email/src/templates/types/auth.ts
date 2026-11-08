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
  "phone-removed",
  "sign-in-method-removed",
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
  "staff-email-change-confirm",
  "staff-email-change-notice",
  "staff-email-change-cancelled-notice",
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
  "phone-removed": SecurityNoticeVars & {
    /** Already masked, for example "+44 •••• 1234". */
    maskedPhone: string;
  };
  "sign-in-method-removed": SecurityNoticeVars & {
    /** The provider that was removed, already in display form: "Google" or "Apple". */
    providerName: string;
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
  /** A copy of the person's data was requested: says when and on which device, like any security notice. */
  "data-export-requested": SecurityNoticeVars;
  /** The copy is ready. Links to LAX Account, never to the file. */
  "data-export-ready": {
    userName?: string | null;
    /** LAX Account's download page, where a recent sign-in releases the file. */
    dataExportUrl: string;
    /** When the copy is deleted, formatted by the sender (Europe/London). */
    expiresDisplay: string;
    /** Days the copy stays available. */
    retentionDays: number;
  };
  /** Sent a week before the personal data is erased. */
  "account-deletion-reminder": {
    userName?: string | null;
    /** Day the data is erased, formatted by the sender (Europe/London). */
    effectiveDateDisplay: string;
    /** Whole days left, as the sender counted them. */
    daysLeft: number;
    cancelDeletionUrl: string;
  };
  /** The purge found something open and kept the details; says what, and when it looks again. */
  "account-deletion-held": {
    userName?: string | null;
    /** The wording below comes from one copy file so it can be reviewed as a whole. */
    title: string;
    basis: string;
    reasonsIntro: string;
    reasons: string[];
    /** "We'll check again on 4 December." */
    recheck: string;
    resolution: string;
    cancelDeletionUrl: string;
  };
  /**
   * Sent to an address copied just before the account was erased. It carries no name or other
   * personal detail, because the row that holds it outlives the account.
   */
  "account-deletion-completed": {
    /** Day the data was erased, formatted by the sender (Europe/London). */
    erasedOnDisplay: string;
  };
  "change-email": {
    confirmationUrl: string;
    oldEmail: string;
    newEmail: string;
    userName?: string | null;
    /** Which inbox received this message — copy differs for current vs new address. */
    recipient: "current" | "new";
  };
  /** To the new address once LAX client services have started the change; the person opens the link. */
  "staff-email-change-confirm": {
    confirmationUrl: string;
    oldEmail: string;
    newEmail: string;
    userName?: string | null;
    /** How long the link works. */
    validForDays: number;
  };
  /** To the address on file when LAX client services start moving the account to a new one. */
  "staff-email-change-notice": SecurityNoticeVars & {
    newEmail: string;
  };
  /** To the address on file when LAX staff cancel a pending change of it. */
  "staff-email-change-cancelled-notice": SecurityNoticeVars;
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
    "phone-removed": "live",
    "sign-in-method-removed": "live",
    "social-account-linked": "live",
    "social-account-unlinked": "live",
    "new-device-login": "live",
    "password-changed-elsewhere": "live",
    "password-changed-sessions-not-revoked": "live",
    "change-email": "snapshot",
    "account-deletion-requested": "live",
    "account-deletion-cancelled": "live",
    "data-export-requested": "live",
    "data-export-ready": "live",
    "account-deletion-reminder": "live",
    "account-deletion-held": "live",
    "account-deletion-completed": "snapshot",
    // Each goes to an address the account does not (or no longer) holds, so it is fixed at send.
    "staff-email-change-confirm": "snapshot",
    "staff-email-change-notice": "snapshot",
    // The account keeps its address, so the notice goes to whatever it is now.
    "staff-email-change-cancelled-notice": "live",
  },
} satisfies TemplateDomainSlice<AuthTemplateName, AuthTemplateVars>;

export type { AuthTemplateName, AuthTemplateVars };
