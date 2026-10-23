import type {
  AccountAddress,
  AccountAddressDefaultKind,
  AccountAddressInput,
} from "@auction/identity-contracts";
export type IdentityIssuerRequestContext = {
  headers?: Headers | undefined;
};

export type IdentityIssuerSignUpInput = IdentityIssuerRequestContext & {
  name: string;
  email: string;
  password: string;
  callbackURL: string;
};

export type IdentitySubject = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  identityDisabledAt: Date | null;
  mergedIntoSubjectId: string | null;
};

export type IdentitySession = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  lastPasswordAuthAt: Date | null;
  isCurrent: boolean;
};

export type IdentitySecurityStatus = {
  twoFactorEnabled: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  pendingNewEmail: string | null;
  emailChangeExpiresAt: Date | null;
};

export interface IIdentityIssuerClient {
  signUpEmail(input: IdentityIssuerSignUpInput): Promise<{ userId: string }>;
  sendVerificationEmail(
    input: IdentityIssuerRequestContext & { email: string; callbackURL: string },
  ): Promise<void>;
  requestPasswordReset(
    input: IdentityIssuerRequestContext & { email: string; redirectTo: string },
  ): Promise<void>;
  requestMagicLink(
    input: IdentityIssuerRequestContext & {
      email: string;
      callbackURL: string;
      errorCallbackURL: string;
    },
  ): Promise<void>;
}

export interface IIdentitySubjectClient {
  readSubject(subjectId: string): Promise<IdentitySubject | null>;
  findSubjectByEmail(email: string): Promise<IdentitySubject | null>;
  findByEmail(email: string): Promise<{ userId: string; emailVerified: boolean } | null>;
  deleteOrphanSubject(subjectId: string): Promise<boolean>;
}

export interface IIdentitySecurityClient {
  readSecurityStatus(subjectId: string): Promise<IdentitySecurityStatus | null>;
}

export type IdentityTwoFactorPolicyScope =
  | { scope: "staff" }
  | { scope: "org"; legalEntityId: string };

export type IdentityTwoFactorRequirement = {
  required: boolean;
  sources: IdentityTwoFactorPolicyScope[];
};

export type IdentityTwoFactorPolicyView = {
  policy: { required: boolean; setBySubjectId: string | null; setAt: Date | null };
  coverage: { members: number; enrolled: number };
};

/** Identity owns two-step verification policy (D35); Bid decides who may change it. */
export interface IIdentityTwoFactorPolicyClient {
  readTwoFactorRequirement(subjectId: string): Promise<IdentityTwoFactorRequirement>;
  readTwoFactorPolicy(scope: IdentityTwoFactorPolicyScope): Promise<IdentityTwoFactorPolicyView>;
  writeTwoFactorPolicy(
    scope: IdentityTwoFactorPolicyScope,
    input: { required: boolean; actorSubjectId: string },
  ): Promise<IdentityTwoFactorPolicyView>;
  readTwoFactorStatuses(subjectIds: readonly string[]): Promise<Map<string, boolean>>;
  readSecuritySummaries(
    subjectIds: readonly string[],
  ): Promise<Map<string, IdentitySubjectSecuritySummary>>;
}

/** `lastSignInAt` is the newest session Identity still holds, so it can be null. */
export type IdentitySubjectSecuritySummary = {
  twoFactorEnabled: boolean;
  lastSignInAt: Date | null;
};

export interface IIdentityCredentialClient {
  credentialSummary(
    subjectId: string,
  ): Promise<{ hasPassword: boolean; linkedProviders: string[] }>;
  hasCredentialAccount(subjectId: string): Promise<boolean>;
  hasLinkedProvider(subjectId: string, provider: "google" | "apple"): Promise<boolean>;
  setupPassword(input: {
    subjectId: string;
    password: string;
    sessionToken?: string;
  }): Promise<void>;
  stepUpStatus(input: {
    subjectId: string;
    sessionToken: string;
  }): Promise<{ hasCredential: boolean; lastPasswordAuthAt: Date | null }>;
  verifyPasswordAndStamp(input: {
    subjectId: string;
    password: string;
    sessionToken: string;
  }): Promise<void>;
  changePassword(input: {
    subjectId: string;
    currentPassword: string;
    newPassword: string;
    sessionToken: string;
  }): Promise<void>;
}

export interface IIdentitySessionClient {
  listSessions(subjectId: string, currentSessionToken?: string): Promise<IdentitySession[]>;
  revokeSession(subjectId: string, sessionId: string): Promise<boolean>;
  revokeAllSessions(subjectId: string, exceptSessionToken?: string): Promise<number>;
}

export interface IIdentityEmailChangeClient {
  /**
   * Starts the change and has the issuer email both inboxes. Rejects with an
   * IdentityIssuerClientError coded `email_taken`, `same_email` or `subject_not_found`.
   */
  startEmailChange(input: { subjectId: string; newEmail: string }): Promise<void>;
  pendingEmailChange(subjectId: string): Promise<string | null>;
  cancelEmailChange(subjectId: string): Promise<void>;
  /** `completed` is false after the first of the two inboxes confirms. */
  confirmEmailChange(input: { token: string }): Promise<{
    subjectId: string;
    completed: boolean;
    confirmedFor: "old" | "new";
  }>;
}

export interface IIdentityProfileClient {
  updateSubjectProfile(
    subjectId: string,
    patch: { name?: string; image?: string | null },
  ): Promise<void>;
  markDeletionRequested(subjectId: string): Promise<void>;
}

/**
 * The LAX-wide address book, which Identity owns. Every method rejects with an
 * IdentityIssuerClientError; a refusal the caller can act on carries the issuer's code
 * (`invalid_address`, `address_not_found`, `address_limit_reached`, `version_conflict`).
 */
export interface IIdentityAddressClient {
  listAddresses(subjectId: string): Promise<AccountAddress[]>;
  createAddress(subjectId: string, address: AccountAddressInput): Promise<AccountAddress>;
  updateAddress(
    subjectId: string,
    addressId: string,
    expectedVersion: number,
    address: AccountAddressInput,
  ): Promise<AccountAddress>;
  deleteAddress(subjectId: string, addressId: string, expectedVersion: number): Promise<void>;
  setDefaultAddress(
    subjectId: string,
    addressId: string,
    kind: AccountAddressDefaultKind,
  ): Promise<AccountAddress>;
}
