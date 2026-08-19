export type IdentityOperationTransaction = unknown;

export type IdentitySubjectRecord = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  identityDisabledAt: Date | null;
  mergedIntoSubjectId: string | null;
};

export type IdentitySessionRecord = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  lastPasswordAuthAt: Date | null;
  isCurrent: boolean;
};

export type IdentityEmailChangeRecord = {
  email: string;
  name: string;
  phoneNumber: string | null;
  pendingNewEmail: string | null;
  emailChangeOldOk: boolean;
  emailChangeNewOk: boolean;
  emailChangeExpiresAt: Date | null;
};

export interface IIdentityUnitOfWork {
  transaction(
    operation: (transaction: IdentityOperationTransaction) => Promise<void>,
  ): Promise<void>;
}

export interface IIdentitySubjectRepository {
  findById(subjectId: string): Promise<IdentitySubjectRecord | null>;
  findByEmail(email: string): Promise<IdentitySubjectRecord | null>;
  updateProfile(
    subjectId: string,
    patch: { name?: string; image?: string | null },
    now: Date,
  ): Promise<{ id: string; name: string } | null>;
  markDeletionRequested(subjectId: string, now: Date): Promise<boolean>;
  lockForCompensation(
    transaction: IdentityOperationTransaction,
    subjectId: string,
  ): Promise<{ id: string; createdAt: Date } | null>;
  listAccountProviders(
    transaction: IdentityOperationTransaction,
    subjectId: string,
  ): Promise<string[]>;
  deleteSubject(transaction: IdentityOperationTransaction, subjectId: string): Promise<boolean>;
}

export interface IIdentityCredentialRepository {
  listProviders(subjectId: string): Promise<Array<{ providerId: string; hasPassword: boolean }>>;
  findCredential(subjectId: string): Promise<{ id: string; passwordHash: string | null } | null>;
  insertCredential(
    transaction: IdentityOperationTransaction,
    input: {
      id: string;
      subjectId: string;
      passwordHash: string;
      now: Date;
    },
  ): Promise<"inserted" | "already_set">;
  updatePassword(
    transaction: IdentityOperationTransaction,
    input: { credentialId: string; subjectId: string; passwordHash: string; now: Date },
  ): Promise<void>;
}

export interface IIdentitySessionRepository {
  listForSubject(subjectId: string, currentSessionToken?: string): Promise<IdentitySessionRecord[]>;
  findStamp(
    subjectId: string,
    sessionToken: string,
  ): Promise<{ lastPasswordAuthAt: Date | null } | null>;
  stampPasswordAuth(
    transaction: IdentityOperationTransaction | null,
    input: { subjectId: string; sessionToken: string; now: Date; stepUp: boolean },
  ): Promise<boolean>;
  ownsSession(subjectId: string, sessionId: string): Promise<boolean>;
  deleteSession(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    sessionId: string,
  ): Promise<boolean>;
  deleteAllSessions(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    exceptSessionToken?: string,
  ): Promise<number>;
  purgeSubjectSessionsAndTokens(
    transaction: IdentityOperationTransaction | null,
    subjectId: string,
  ): Promise<void>;
}

export interface IIdentityEmailChangeRepository {
  startChange(input: {
    subjectId: string;
    newEmail: string;
    expiresAt: Date;
    now: Date;
  }): Promise<void>;
  readPending(subjectId: string): Promise<string | null>;
  clearPending(subjectId: string, now: Date): Promise<void>;
  loadForConfirmation(
    transaction: IdentityOperationTransaction,
    subjectId: string,
  ): Promise<IdentityEmailChangeRecord | null>;
  markConfirmed(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    confirmFor: "old" | "new",
    now: Date,
  ): Promise<void>;
  findEmailOwner(
    transaction: IdentityOperationTransaction,
    email: string,
    exceptSubjectId: string,
  ): Promise<string | null>;
  applyPendingEmail(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    newEmail: string,
    now: Date,
  ): Promise<void>;
}

export interface IIdentityVerificationPurger {
  purgeExpired(now: Date, batchSize: number): Promise<number>;
}

export type IdentityOperationsRepositories = {
  unitOfWork: IIdentityUnitOfWork;
  subjects: IIdentitySubjectRepository;
  credentials: IIdentityCredentialRepository;
  sessions: IIdentitySessionRepository;
  emailChanges: IIdentityEmailChangeRepository;
  verifications: IIdentityVerificationPurger;
};
