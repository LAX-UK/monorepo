import { randomUUID } from "node:crypto";
import type { IdentityEventPublisher, ProductSubjectUsageProbe } from "@auction/auth";
import type { Database } from "@auction/db";
import { account, oauthAccessToken, session, user, verification } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import { hashPassword, verifyPassword } from "@better-auth/utils/password";
import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { setupPasswordBodySchema } from "../schemas/setup-password.js";
import type { BackchannelLogoutService } from "./backchannel-logout.service.js";
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

export class IdentityOperationsService {
  constructor(
    private readonly db: Database,
    private readonly emailService: Pick<IEmailService, "enqueue">,
    private readonly productSubjectUsage: ProductSubjectUsageProbe,
    private readonly identityEventPublisher: IdentityEventPublisher,
    private readonly logout?: Pick<
      BackchannelLogoutService,
      "revokeIdentitySessions" | "revokeSubject"
    >,
  ) {}

  async readSubject(subjectId: string): Promise<IdentitySubject | null> {
    const [row] = await this.db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        identityDisabledAt: user.identityDisabledAt,
        mergedIntoSubjectId: user.mergedIntoSubjectId,
      })
      .from(user)
      .where(eq(user.id, subjectId))
      .limit(1);
    return row ?? null;
  }

  async findSubjectByEmail(email: string): Promise<IdentitySubject | null> {
    const [row] = await this.db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        identityDisabledAt: user.identityDisabledAt,
        mergedIntoSubjectId: user.mergedIntoSubjectId,
      })
      .from(user)
      .where(sql`lower(trim(${user.email})) = ${email.trim().toLowerCase()}`)
      .limit(1);
    return row ?? null;
  }

  async credentialSummary(subjectId: string): Promise<{
    hasPassword: boolean;
    linkedProviders: string[];
  }> {
    const rows = await this.db
      .select({ providerId: account.providerId, password: account.password })
      .from(account)
      .where(eq(account.userId, subjectId));
    return {
      hasPassword: rows.some((row) => row.providerId === "credential" && Boolean(row.password)),
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
    await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: account.id })
        .from(account)
        .where(and(eq(account.userId, subjectId), eq(account.providerId, "credential")))
        .limit(1);
      if (existing) throw new IdentityOperationError("already_set");
      const now = new Date();
      await tx.insert(account).values({
        id: randomUUID(),
        accountId: subjectId,
        providerId: "credential",
        userId: subjectId,
        password: passwordHash,
        createdAt: now,
        updatedAt: now,
      });
      if (sessionToken) {
        await tx
          .update(session)
          .set({ lastPasswordAuthAt: now, updatedAt: now })
          .where(
            and(
              eq(session.userId, subjectId),
              or(eq(session.token, sessionToken), eq(session.id, sessionToken)),
            ),
          );
      }
      await this.identityEventPublisher.publish(
        { type: "user.credential_changed", userId: subjectId, changeType: "create" },
        { transaction: tx },
      );
    });
    await this.logout?.revokeSubject(subjectId);
    await this.db.delete(session).where(eq(session.userId, subjectId));
    await this.db.delete(oauthAccessToken).where(eq(oauthAccessToken.userId, subjectId));
    await this.emailService.enqueue({
      template: "password-changed",
      to: subject.email,
      userId: subjectId,
      category: "auth",
      vars: { userName: subject.name },
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
      this.db
        .select({ id: account.id })
        .from(account)
        .where(and(eq(account.userId, subjectId), eq(account.providerId, "credential")))
        .limit(1),
      this.db
        .select({ lastPasswordAuthAt: session.lastPasswordAuthAt })
        .from(session)
        .where(
          and(
            eq(session.userId, subjectId),
            or(eq(session.token, sessionToken), eq(session.id, sessionToken)),
          ),
        )
        .limit(1),
    ]);
    if (!currentSession[0]) throw new IdentityOperationError("no_session");
    return {
      hasCredential: Boolean(credential[0]),
      lastPasswordAuthAt: currentSession[0].lastPasswordAuthAt,
    };
  }

  async verifyPasswordAndStamp(
    subjectId: string,
    password: string,
    sessionToken: string,
  ): Promise<void> {
    const [credential] = await this.db
      .select({ password: account.password })
      .from(account)
      .where(and(eq(account.userId, subjectId), eq(account.providerId, "credential")))
      .limit(1);
    if (!credential?.password) throw new IdentityOperationError("no_credential");
    if (!(await verifyPassword(credential.password, password))) {
      throw new IdentityOperationError("invalid_password");
    }
    const now = new Date();
    const updated = await this.db
      .update(session)
      .set({ lastPasswordAuthAt: now, lastStepUpAt: now, updatedAt: now })
      .where(
        and(
          eq(session.userId, subjectId),
          or(eq(session.token, sessionToken), eq(session.id, sessionToken)),
        ),
      )
      .returning({ id: session.id });
    if (!updated[0]) throw new IdentityOperationError("no_session");
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
    const [credential] = await this.db
      .select({ id: account.id, password: account.password })
      .from(account)
      .where(and(eq(account.userId, subjectId), eq(account.providerId, "credential")))
      .limit(1);
    if (!credential?.password || !(await verifyPassword(credential.password, currentPassword))) {
      throw new IdentityOperationError("invalid_password");
    }
    const password = await hashPassword(newPassword);
    await this.db.transaction(async (tx) => {
      const changedAt = new Date();
      await tx
        .update(account)
        .set({ password, updatedAt: changedAt })
        .where(and(eq(account.id, credential.id), eq(account.userId, subjectId)));
      const updated = await tx
        .update(session)
        .set({ lastPasswordAuthAt: new Date(), lastStepUpAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(session.userId, subjectId),
            or(eq(session.token, sessionToken), eq(session.id, sessionToken)),
          ),
        )
        .returning({ id: session.id });
      if (!updated[0]) throw new IdentityOperationError("no_session");
      await this.identityEventPublisher.publish(
        { type: "user.credential_changed", userId: subjectId, changeType: "update" },
        { transaction: tx },
      );
    });
  }

  async listSessions(subjectId: string, currentSessionToken?: string): Promise<IdentitySession[]> {
    const rows = await this.db
      .select({
        id: session.id,
        token: session.token,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        lastPasswordAuthAt: session.lastPasswordAuthAt,
      })
      .from(session)
      .where(eq(session.userId, subjectId))
      .orderBy(desc(session.createdAt));
    return rows.map(({ token, ...row }) => ({
      ...row,
      isCurrent: Boolean(currentSessionToken) && token === currentSessionToken,
    }));
  }

  async revokeSession(subjectId: string, sessionId: string): Promise<boolean> {
    const [owned] = await this.db
      .select({ id: session.id })
      .from(session)
      .where(and(eq(session.userId, subjectId), eq(session.id, sessionId)))
      .limit(1);
    if (!owned) return false;
    await this.logout?.revokeIdentitySessions([sessionId]);
    const rows = await this.db.transaction(async (tx) => {
      const deleted = await tx
        .delete(session)
        .where(and(eq(session.userId, subjectId), eq(session.id, sessionId)))
        .returning({ id: session.id });
      if (deleted.length > 0) {
        await this.identityEventPublisher.publish(
          { type: "user.session_revoked", userId: subjectId, sessionId },
          { transaction: tx },
        );
      }
      return deleted;
    });
    return rows.length > 0;
  }

  async revokeAllSessions(subjectId: string, exceptSessionToken?: string): Promise<number> {
    await this.logout?.revokeSubject(subjectId);
    const where = exceptSessionToken
      ? and(eq(session.userId, subjectId), ne(session.token, exceptSessionToken))
      : eq(session.userId, subjectId);
    const rows = await this.db.transaction(async (tx) => {
      const deleted = await tx.delete(session).where(where).returning({ id: session.id });
      if (deleted.length > 0) {
        await this.identityEventPublisher.publish(
          { type: "user.session_revoked", userId: subjectId },
          { transaction: tx },
        );
      }
      return deleted;
    });
    return rows.length;
  }

  async startEmailChange(subjectId: string, newEmail: string, expiresAt: Date): Promise<void> {
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new IdentityOperationError("invalid_expiry");
    }
    const normalized = newEmail.trim().toLowerCase();
    const [subject, clash] = await Promise.all([
      this.readSubject(subjectId),
      this.findSubjectByEmail(normalized),
    ]);
    if (!subject) throw new IdentityOperationError("subject_not_found");
    if (clash && clash.id !== subjectId) throw new IdentityOperationError("email_taken");
    await this.db
      .update(user)
      .set({
        pendingNewEmail: normalized,
        emailChangeOldOk: false,
        emailChangeNewOk: false,
        emailChangeExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(user.id, subjectId));
  }

  async pendingEmailChange(subjectId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ pendingNewEmail: user.pendingNewEmail })
      .from(user)
      .where(eq(user.id, subjectId))
      .limit(1);
    return row?.pendingNewEmail ?? null;
  }

  async cancelEmailChange(subjectId: string): Promise<void> {
    const pending = await this.pendingEmailChange(subjectId);
    if (!pending) throw new IdentityOperationError("none_in_progress");
    await this.clearPendingEmailChange(subjectId);
  }

  async confirmEmailChange(input: {
    subjectId: string;
    oldEmail: string;
    newEmail: string;
    confirmFor: "old" | "new";
  }): Promise<boolean> {
    const changed = await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(user).where(eq(user.id, input.subjectId)).limit(1);
      if (!row) throw new IdentityOperationError("subject_not_found");
      if (row.pendingNewEmail !== input.newEmail || row.email !== input.oldEmail) {
        throw new IdentityOperationError("stale_flow");
      }
      if (row.emailChangeExpiresAt && row.emailChangeExpiresAt.getTime() < Date.now()) {
        throw new IdentityOperationError("expired");
      }
      const confirmation =
        input.confirmFor === "old" ? { emailChangeOldOk: true } : { emailChangeNewOk: true };
      await tx
        .update(user)
        .set({ ...confirmation, updatedAt: new Date() })
        .where(eq(user.id, input.subjectId));
      const [fresh] = await tx.select().from(user).where(eq(user.id, input.subjectId)).limit(1);
      if (!fresh?.emailChangeOldOk || !fresh.emailChangeNewOk || !fresh.pendingNewEmail)
        return false;
      const [clash] = await tx
        .select({ id: user.id })
        .from(user)
        .where(
          and(
            sql`lower(trim(${user.email})) = ${fresh.pendingNewEmail.trim().toLowerCase()}`,
            ne(user.id, input.subjectId),
          ),
        )
        .limit(1);
      if (clash) throw new IdentityOperationError("email_taken");
      const now = new Date();
      await tx
        .update(user)
        .set({
          email: fresh.pendingNewEmail,
          emailVerified: true,
          pendingNewEmail: null,
          emailChangeOldOk: false,
          emailChangeNewOk: false,
          emailChangeExpiresAt: null,
          updatedAt: now,
        })
        .where(eq(user.id, input.subjectId));
      await tx.delete(session).where(eq(session.userId, input.subjectId));
      await tx.delete(oauthAccessToken).where(eq(oauthAccessToken.userId, input.subjectId));
      await publishIdentityProfileUpdated(
        this.identityEventPublisher,
        {
          subjectId: input.subjectId,
          email: fresh.pendingNewEmail,
          name: fresh.name,
          phone: fresh.phoneNumber ?? null,
        },
        { transaction: tx },
      );
      return true;
    });
    if (changed) await this.logout?.revokeSubject(input.subjectId);
    return changed;
  }

  async deleteOrphanSubject(subjectId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [subject] = await tx
        .select({ id: user.id, createdAt: user.createdAt })
        .from(user)
        .where(eq(user.id, subjectId))
        .limit(1)
        .for("update");
      if (!subject) return false;

      // Compensation is only valid immediately after API-managed email signup.
      // Never let this endpoint become a general-purpose subject delete.
      const accounts = await tx
        .select({ providerId: account.providerId })
        .from(account)
        .where(eq(account.userId, subjectId));
      const [hasProductProfile, hasExternalLink] = await Promise.all([
        this.productSubjectUsage.hasProductProfile(subjectId),
        this.productSubjectUsage.hasExternalLink(subjectId),
      ]);
      if (
        !isCompensatableOrphan({
          createdAt: subject.createdAt,
          accountProviderIds: accounts.map((row) => row.providerId),
          hasProductProfile,
          hasExternalLink,
        })
      ) {
        throw new IdentityOperationError("not_orphan");
      }

      await this.identityEventPublisher.publish(
        { type: "user.identity_deleted", userId: subjectId },
        { transaction: tx },
      );
      const rows = await tx.delete(user).where(eq(user.id, subjectId)).returning({ id: user.id });
      return rows.length > 0;
    });
  }

  async updateSubjectProfile(
    subjectId: string,
    patch: { name?: string; image?: string | null },
  ): Promise<void> {
    const [updated] = await this.db
      .update(user)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(user.id, subjectId))
      .returning({
        id: user.id,
        name: user.name,
      });
    if (!updated) throw new IdentityOperationError("subject_not_found");
    await publishIdentityProfileUpdated(this.identityEventPublisher, {
      subjectId: updated.id,
      name: updated.name,
    });
  }

  async markDeletionRequested(subjectId: string): Promise<void> {
    const rows = await this.db
      .update(user)
      .set({ deletionRequestedAt: new Date(), updatedAt: new Date() })
      .where(eq(user.id, subjectId))
      .returning({ id: user.id });
    if (!rows[0]) throw new IdentityOperationError("subject_not_found");
  }

  async purgeExpiredVerifications(now = new Date(), batchSize = 500): Promise<number> {
    const rows = await this.db
      .delete(verification)
      .where(
        inArray(
          verification.id,
          this.db
            .select({ id: verification.id })
            .from(verification)
            .where(sql`${verification.expiresAt} < ${now}`)
            .limit(batchSize),
        ),
      )
      .returning({ id: verification.id });
    return rows.length;
  }

  private async clearPendingEmailChange(subjectId: string): Promise<void> {
    await this.db
      .update(user)
      .set({
        pendingNewEmail: null,
        emailChangeOldOk: false,
        emailChangeNewOk: false,
        emailChangeExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, subjectId));
  }
}
