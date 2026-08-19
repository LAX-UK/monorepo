import { randomUUID } from "node:crypto";
import type { IdentityEventPublisher, ProductSubjectUsageProbe } from "@auction/auth";
import { hashPassword, verifyPassword } from "@better-auth/utils/password";
import { setupPasswordBodySchema } from "../schemas/setup-password.js";
import type { BackchannelLogoutService } from "./backchannel-logout.service.js";
import type { IIdentityNotifier } from "./identity-notification.ports.js";
import type {
  IdentityOperationsRepositories,
  IdentitySessionRecord,
  IdentitySubjectRecord,
} from "./identity-operations.ports.js";
import { publishIdentityProfileUpdated } from "./publish-identity-profile-updated.js";

export type IdentityOperationErrorCode =
  | "already_set"
  | "email_taken"
  | "expired"
  | "invalid_password"
  | "invalid_password_policy"
  | "invalid_expiry"
  | "no_credential"
  | "no_session"
  | "none_in_progress"
  | "not_orphan"
  | "stale_flow"
  | "subject_not_found";

export class IdentityOperationError extends Error {
  constructor(readonly code: IdentityOperationErrorCode) {
    super(code);
    this.name = "IdentityOperationError";
  }
}

export function isCompensatableOrphan(input: {
  createdAt: Date;
  accountProviderIds: readonly string[];
  hasProductProfile: boolean;
  hasExternalLink: boolean;
  now?: number;
}): boolean {
  const ageMs = (input.now ?? Date.now()) - input.createdAt.getTime();
  return (
    ageMs >= 0 &&
    ageMs <= 15 * 60 * 1000 &&
    input.accountProviderIds.length > 0 &&
    input.accountProviderIds.every((providerId) => providerId === "credential") &&
    !input.hasProductProfile &&
    !input.hasExternalLink
  );
}

export type IdentitySubject = IdentitySubjectRecord;
export type IdentitySession = IdentitySessionRecord;

export class IdentityOperationsService {
  constructor(
    private readonly repositories: IdentityOperationsRepositories,
    private readonly notifier: IIdentityNotifier,
    private readonly productSubjectUsage: ProductSubjectUsageProbe,
    private readonly identityEventPublisher: IdentityEventPublisher,
    private readonly logout?: Pick<
      BackchannelLogoutService,
      "revokeIdentitySessions" | "revokeSubject"
    >,
    private readonly now: () => Date = () => new Date(),
  ) {}

  readSubject(subjectId: string): Promise<IdentitySubject | null> {
    return this.repositories.subjects.findById(subjectId);
  }

  findSubjectByEmail(email: string): Promise<IdentitySubject | null> {
    return this.repositories.subjects.findByEmail(email);
  }

  async credentialSummary(subjectId: string): Promise<{
    hasPassword: boolean;
    linkedProviders: string[];
  }> {
    const rows = await this.repositories.credentials.listProviders(subjectId);
    return {
      hasPassword: rows.some((row) => row.providerId === "credential" && row.hasPassword),
      linkedProviders: [...new Set(rows.map((row) => row.providerId))],
    };
  }

  async setupPassword(subjectId: string, password: string, sessionToken?: string): Promise<void> {
    if (!setupPasswordBodySchema.safeParse({ password }).success) {
      throw new IdentityOperationError("invalid_password_policy");
    }
    const subject = await this.readSubject(subjectId);
    if (!subject) throw new IdentityOperationError("subject_not_found");
    const passwordHash = await hashPassword(password);
    await this.repositories.unitOfWork.transaction(async (transaction) => {
      const now = this.now();
      const outcome = await this.repositories.credentials.insertCredential(transaction, {
        id: randomUUID(),
        subjectId,
        passwordHash,
        now,
      });
      if (outcome === "already_set") throw new IdentityOperationError("already_set");
      if (sessionToken) {
        await this.repositories.sessions.stampPasswordAuth(transaction, {
          subjectId,
          sessionToken,
          now,
          stepUp: false,
        });
      }
      await this.identityEventPublisher.publish(
        { type: "user.credential_changed", userId: subjectId, changeType: "create" },
        { transaction },
      );
    });
    await this.logout?.revokeSubject(subjectId);
    await this.repositories.sessions.purgeSubjectSessionsAndTokens(null, subjectId);
    await this.notifier.passwordChanged({
      to: subject.email,
      subjectId,
      userName: subject.name,
    });
  }

  async stepUpStatus(
    subjectId: string,
    sessionToken: string,
  ): Promise<{
    hasCredential: boolean;
    lastPasswordAuthAt: Date | null;
  }> {
    const [credential, currentSession] = await Promise.all([
      this.repositories.credentials.findCredential(subjectId),
      this.repositories.sessions.findStamp(subjectId, sessionToken),
    ]);
    if (!currentSession) throw new IdentityOperationError("no_session");
    return {
      hasCredential: Boolean(credential),
      lastPasswordAuthAt: currentSession.lastPasswordAuthAt,
    };
  }

  async verifyPasswordAndStamp(
    subjectId: string,
    password: string,
    sessionToken: string,
  ): Promise<void> {
    const credential = await this.repositories.credentials.findCredential(subjectId);
    if (!credential?.passwordHash) throw new IdentityOperationError("no_credential");
    if (!(await verifyPassword(credential.passwordHash, password))) {
      throw new IdentityOperationError("invalid_password");
    }
    const updated = await this.repositories.sessions.stampPasswordAuth(null, {
      subjectId,
      sessionToken,
      now: this.now(),
      stepUp: true,
    });
    if (!updated) throw new IdentityOperationError("no_session");
  }

  async changePassword(
    subjectId: string,
    currentPassword: string,
    newPassword: string,
    sessionToken: string,
  ): Promise<void> {
    if (!setupPasswordBodySchema.safeParse({ password: newPassword }).success) {
      throw new IdentityOperationError("invalid_password_policy");
    }
    const credential = await this.repositories.credentials.findCredential(subjectId);
    if (
      !credential?.passwordHash ||
      !(await verifyPassword(credential.passwordHash, currentPassword))
    ) {
      throw new IdentityOperationError("invalid_password");
    }
    const passwordHash = await hashPassword(newPassword);
    await this.repositories.unitOfWork.transaction(async (transaction) => {
      const changedAt = this.now();
      await this.repositories.credentials.updatePassword(transaction, {
        credentialId: credential.id,
        subjectId,
        passwordHash,
        now: changedAt,
      });
      const updated = await this.repositories.sessions.stampPasswordAuth(transaction, {
        subjectId,
        sessionToken,
        now: changedAt,
        stepUp: true,
      });
      if (!updated) throw new IdentityOperationError("no_session");
      await this.identityEventPublisher.publish(
        { type: "user.credential_changed", userId: subjectId, changeType: "update" },
        { transaction },
      );
    });
  }

  listSessions(subjectId: string, currentSessionToken?: string): Promise<IdentitySession[]> {
    return this.repositories.sessions.listForSubject(subjectId, currentSessionToken);
  }

  async revokeSession(subjectId: string, sessionId: string): Promise<boolean> {
    if (!(await this.repositories.sessions.ownsSession(subjectId, sessionId))) return false;
    await this.logout?.revokeIdentitySessions([sessionId]);
    let deleted = false;
    await this.repositories.unitOfWork.transaction(async (transaction) => {
      deleted = await this.repositories.sessions.deleteSession(transaction, subjectId, sessionId);
      if (deleted) {
        await this.identityEventPublisher.publish(
          { type: "user.session_revoked", userId: subjectId, sessionId },
          { transaction },
        );
      }
    });
    return deleted;
  }

  async revokeAllSessions(subjectId: string, exceptSessionToken?: string): Promise<number> {
    await this.logout?.revokeSubject(subjectId);
    let deletedCount = 0;
    await this.repositories.unitOfWork.transaction(async (transaction) => {
      deletedCount = await this.repositories.sessions.deleteAllSessions(
        transaction,
        subjectId,
        exceptSessionToken,
      );
      if (deletedCount > 0) {
        await this.identityEventPublisher.publish(
          { type: "user.session_revoked", userId: subjectId },
          { transaction },
        );
      }
    });
    return deletedCount;
  }

  async startEmailChange(subjectId: string, newEmail: string, expiresAt: Date): Promise<void> {
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= this.now().getTime()) {
      throw new IdentityOperationError("invalid_expiry");
    }
    const normalized = newEmail.trim().toLowerCase();
    const [subject, clash] = await Promise.all([
      this.readSubject(subjectId),
      this.findSubjectByEmail(normalized),
    ]);
    if (!subject) throw new IdentityOperationError("subject_not_found");
    if (clash && clash.id !== subjectId) throw new IdentityOperationError("email_taken");
    await this.repositories.emailChanges.startChange({
      subjectId,
      newEmail: normalized,
      expiresAt,
      now: this.now(),
    });
  }

  pendingEmailChange(subjectId: string): Promise<string | null> {
    return this.repositories.emailChanges.readPending(subjectId);
  }

  async cancelEmailChange(subjectId: string): Promise<void> {
    const pending = await this.pendingEmailChange(subjectId);
    if (!pending) throw new IdentityOperationError("none_in_progress");
    await this.repositories.emailChanges.clearPending(subjectId, this.now());
  }

  async confirmEmailChange(input: {
    subjectId: string;
    oldEmail: string;
    newEmail: string;
    confirmFor: "old" | "new";
  }): Promise<boolean> {
    let changed = false;
    await this.repositories.unitOfWork.transaction(async (transaction) => {
      const row = await this.repositories.emailChanges.loadForConfirmation(
        transaction,
        input.subjectId,
      );
      if (!row) throw new IdentityOperationError("subject_not_found");
      if (row.pendingNewEmail !== input.newEmail || row.email !== input.oldEmail) {
        throw new IdentityOperationError("stale_flow");
      }
      if (row.emailChangeExpiresAt && row.emailChangeExpiresAt.getTime() < this.now().getTime()) {
        throw new IdentityOperationError("expired");
      }
      await this.repositories.emailChanges.markConfirmed(
        transaction,
        input.subjectId,
        input.confirmFor,
        this.now(),
      );
      const fresh = await this.repositories.emailChanges.loadForConfirmation(
        transaction,
        input.subjectId,
      );
      if (!fresh?.emailChangeOldOk || !fresh.emailChangeNewOk || !fresh.pendingNewEmail) return;
      const clash = await this.repositories.emailChanges.findEmailOwner(
        transaction,
        fresh.pendingNewEmail,
        input.subjectId,
      );
      if (clash) throw new IdentityOperationError("email_taken");
      const now = this.now();
      await this.repositories.emailChanges.applyPendingEmail(
        transaction,
        input.subjectId,
        fresh.pendingNewEmail,
        now,
      );
      await this.repositories.sessions.purgeSubjectSessionsAndTokens(transaction, input.subjectId);
      await publishIdentityProfileUpdated(
        this.identityEventPublisher,
        {
          subjectId: input.subjectId,
          email: fresh.pendingNewEmail,
          name: fresh.name,
          phone: fresh.phoneNumber,
        },
        { transaction },
      );
      changed = true;
    });
    if (changed) await this.logout?.revokeSubject(input.subjectId);
    return changed;
  }

  async deleteOrphanSubject(subjectId: string): Promise<boolean> {
    let deleted = false;
    await this.repositories.unitOfWork.transaction(async (transaction) => {
      const subject = await this.repositories.subjects.lockForCompensation(transaction, subjectId);
      if (!subject) return;
      const accountProviderIds = await this.repositories.subjects.listAccountProviders(
        transaction,
        subjectId,
      );
      const [hasProductProfile, hasExternalLink] = await Promise.all([
        this.productSubjectUsage.hasProductProfile(subjectId),
        this.productSubjectUsage.hasExternalLink(subjectId),
      ]);
      if (
        !isCompensatableOrphan({
          createdAt: subject.createdAt,
          accountProviderIds,
          hasProductProfile,
          hasExternalLink,
          now: this.now().getTime(),
        })
      ) {
        throw new IdentityOperationError("not_orphan");
      }
      await this.identityEventPublisher.publish(
        { type: "user.identity_deleted", userId: subjectId },
        { transaction },
      );
      deleted = await this.repositories.subjects.deleteSubject(transaction, subjectId);
    });
    return deleted;
  }

  async updateSubjectProfile(
    subjectId: string,
    patch: { name?: string; image?: string | null },
  ): Promise<void> {
    const updated = await this.repositories.subjects.updateProfile(subjectId, patch, this.now());
    if (!updated) throw new IdentityOperationError("subject_not_found");
    await publishIdentityProfileUpdated(this.identityEventPublisher, {
      subjectId: updated.id,
      name: updated.name,
    });
  }

  async markDeletionRequested(subjectId: string): Promise<void> {
    const updated = await this.repositories.subjects.markDeletionRequested(subjectId, this.now());
    if (!updated) throw new IdentityOperationError("subject_not_found");
  }

  purgeExpiredVerifications(now = new Date(), batchSize = 500): Promise<number> {
    return this.repositories.verifications.purgeExpired(now, batchSize);
  }
}
