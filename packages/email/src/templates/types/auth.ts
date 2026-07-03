import type { TemplateDomainSlice } from "./shared.js";

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
  "social-account-linked",
  "social-account-unlinked",
  "new-device-login",
  "password-changed-elsewhere",
  "password-changed-sessions-not-revoked",
  "change-email",
] as const;

type AuthTemplateName = (typeof names)[number];

type AuthTemplateVars = {
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
  "password-changed": {
    userName?: string | null;
  };
  "2fa-enabled": {
    userName?: string | null;
  };
  "2fa-disabled": {
    userName?: string | null;
  };
  "social-account-linked": {
    provider: "google" | "apple";
    userName?: string | null;
  };
  "social-account-unlinked": {
    provider: "google" | "apple";
    userName?: string | null;
  };
  "new-device-login": {
    userName?: string | null;
    whenDisplay?: string | null;
    deviceSummary?: string | null;
  };
  "password-changed-elsewhere": {
    userName?: string | null;
  };
  "password-changed-sessions-not-revoked": {
    userName?: string | null;
    sessionsSettingsUrl: string;
  };
  "change-email": {
    confirmationUrl: string;
    oldEmail: string;
    newEmail: string;
    userName?: string | null;
    /** Which inbox received this message — copy differs for current vs new address. */
    recipient: "current" | "new";
  };
};

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
    "social-account-linked": "live",
    "social-account-unlinked": "live",
    "new-device-login": "live",
    "password-changed-elsewhere": "live",
    "password-changed-sessions-not-revoked": "live",
    "change-email": "snapshot",
  },
} satisfies TemplateDomainSlice<AuthTemplateName, AuthTemplateVars>;

export type { AuthTemplateName, AuthTemplateVars };
