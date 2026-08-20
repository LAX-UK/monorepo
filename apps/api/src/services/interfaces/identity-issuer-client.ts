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
  startEmailChange(input: {
    subjectId: string;
    newEmail: string;
    expiresAt: Date;
  }): Promise<void>;
  pendingEmailChange(subjectId: string): Promise<string | null>;
  cancelEmailChange(subjectId: string): Promise<void>;
  confirmEmailChange(input: {
    subjectId: string;
    oldEmail: string;
    newEmail: string;
    confirmFor: "old" | "new";
  }): Promise<boolean>;
}

export interface IIdentityProfileClient {
  updateSubjectProfile(
    subjectId: string,
    patch: { name?: string; image?: string | null },
  ): Promise<void>;
  markDeletionRequested(subjectId: string): Promise<void>;
}
