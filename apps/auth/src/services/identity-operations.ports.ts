import type { SocialSignInProvider } from "@auction/identity-contracts";
import type { PasskeyRow, SignInAccountRow } from "./sign-in-method-rules.js";

export type IdentityOperationTransaction = unknown;

export type IdentitySubjectRecord = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  identityDisabledAt: Date | null;
  mergedIntoSubjectId: string | null;
};

export type IdentitySecurityStatusRecord = {
  twoFactorEnabled: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  pendingNewEmail: string | null;
  emailChangeExpiresAt: Date | null;
  /** When the person asked for deletion; null when they have not, or cancelled. */
  deletionRequestedAt: Date | null;
  /** Set while the daily purge is keeping a due deletion back. */
  deletionHeldAt: Date | null;
  deletionHoldReasons: unknown;
};

export type IdentitySessionRecord = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  lastPasswordAuthAt: Date | null;
  /** Earlier ids this sign-in stands for, after newer sign-ins in the same browser took them over. */
  previousIds: readonly string[];
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
  readSecurityStatus(subjectId: string): Promise<IdentitySecurityStatusRecord | null>;
  updateProfile(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    patch: { name?: string; image?: string | null },
    now: Date,
  ): Promise<{ id: string; name: string; image: string | null } | null>;
  /** Stores a verified number, or reports that another person already holds it. */
  setVerifiedPhone(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    phone: string,
    now: Date,
  ): Promise<"updated" | "phone_taken" | "not_found">;
  /** Clears the number and its verified flag, reporting the number that was removed. */
  clearPhone(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    now: Date,
  ): Promise<
    { status: "cleared"; previous: string } | { status: "no_phone" } | { status: "not_found" }
  >;
  markDeletionRequested(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    now: Date,
  ): Promise<boolean>;
  cancelDeletionRequested(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    now: Date,
  ): Promise<boolean>;
  lockForCompensation(
    transaction: IdentityOperationTransaction,
    subjectId: string,
  ): Promise<{ id: string; createdAt: Date } | null>;
  listAccountProviders(
    transaction: IdentityOperationTransaction,
    subjectId: string,
  ): Promise<string[]>;
  deleteSubject(transaction: IdentityOperationTransaction, subjectId: string): Promise<boolean>;
  resetTwoFactorEnrollment(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    now: Date,
  ): Promise<boolean>;
}

export interface IIdentityCredentialRepository {
  listProviders(subjectId: string): Promise<Array<{ providerId: string; hasPassword: boolean }>>;
  /** Every account row that can sign the person in, with when it was added. */
  listSignInAccounts(subjectId: string): Promise<SignInAccountRow[]>;
  /** The person's passkeys, oldest first. Never the key or the credential id. */
  listPasskeys(subjectId: string): Promise<PasskeyRow[]>;
  /** The same rows, locked until the transaction ends, so two removals cannot both pass the last-method check. */
  lockSignInAccounts(
    transaction: IdentityOperationTransaction,
    subjectId: string,
  ): Promise<SignInAccountRow[]>;
  /**
   * Locks the person's passkey rows until the transaction ends and returns how many there are, so
   * a passkey cannot be removed while the last-method check counts it. Always taken after
   * `lockSignInAccounts`, in that order, by every writer, so two removals cannot deadlock.
   */
  lockPasskeys(transaction: IdentityOperationTransaction, subjectId: string): Promise<number>;
  /**
   * Removes one of the person's passkeys, and says what it was called for the email; null when
   * the person has no such passkey (another person's passkey is the same answer). Taken after
   * `lockSignInAccounts` and `lockPasskeys`.
   */
  deletePasskey(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    passkeyId: string,
  ): Promise<{ name: string | null } | null>;
  /** Names one of the person's passkeys; null when the person has no such passkey. */
  renamePasskey(subjectId: string, passkeyId: string, name: string): Promise<PasskeyRow | null>;
  /** Removes one linked social account; false when there was none. */
  deleteSocialAccount(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    provider: SocialSignInProvider,
  ): Promise<boolean>;
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
  /** Deletes every session of the subject except one, by session id. Returns the deleted ids. */
  deleteOtherSessions(
    transaction: IdentityOperationTransaction,
    subjectId: string,
    keepSessionId: string,
  ): Promise<string[]>;
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
  }): Promise<"started" | "address_pending">;
  /** Clears every change whose links have expired; returns how many rows were cleared. */
  clearExpired(now: Date): Promise<number>;
  readPending(
    subjectId: string,
  ): Promise<{ pendingNewEmail: string | null; emailChangeExpiresAt: Date | null } | null>;
  /**
   * Clears the pending change in one conditional update and says whether there was one. A change
   * a confirmation has just applied has no pending address left, so this finds nothing and the
   * caller is told so, instead of reporting a cancel of something already done.
   */
  clearPending(subjectId: string, now: Date): Promise<boolean>;
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
