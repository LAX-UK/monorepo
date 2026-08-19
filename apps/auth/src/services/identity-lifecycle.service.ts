import type { IdentityEventPublisher } from "@auction/auth";
import type { Database } from "@auction/db";
import { account, oauthAccessToken, oauthConsent, session, user } from "@auction/db/schema";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { BackchannelLogoutService } from "./backchannel-logout.service.js";

export interface IIdentityLifecycleService {
  disable(subjectId: string, reason?: string | undefined): Promise<void>;
  enable(subjectId: string): Promise<void>;
  merge(retiredSubjectId: string, canonicalSubjectId: string): Promise<void>;
}

export class IdentityLifecycleConflictError extends Error {
  constructor(readonly code: "subject_not_found" | "invalid_merge") {
    super(code);
  }
}

/** Owns global Identity state transitions, session invalidation, and durable events. */
export class IdentityLifecycleService implements IIdentityLifecycleService {
  constructor(
    private readonly db: Database,
    private readonly identityEventPublisher: IdentityEventPublisher,
    private readonly logout?: Pick<BackchannelLogoutService, "revokeSubject">,
  ) {}

  async disable(subjectId: string, reason?: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(user)
        .set({
          identityDisabledAt: new Date(),
          identityDisabledReason: reason?.trim() || null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(user.id, subjectId),
            isNull(user.identityDisabledAt),
            isNull(user.mergedIntoSubjectId),
          ),
        )
        .returning({ id: user.id, disabledAt: user.identityDisabledAt });
      if (!updated) {
        const existing = await tx.query.user.findFirst({
          where: eq(user.id, subjectId),
          columns: { id: true, identityDisabledAt: true, mergedIntoSubjectId: true },
        });
        if (!existing) throw new IdentityLifecycleConflictError("subject_not_found");
        if (existing.mergedIntoSubjectId) {
          throw new IdentityLifecycleConflictError("invalid_merge");
        }
        return;
      }

      await tx.delete(session).where(eq(session.userId, subjectId));
      await tx.delete(oauthAccessToken).where(eq(oauthAccessToken.userId, subjectId));
      await this.identityEventPublisher.publish(
        {
          type: "user.identity_disabled",
          userId: subjectId,
          ...(reason?.trim() ? { reason: reason.trim() } : {}),
        },
        { producer: "apps/auth", transaction: tx },
      );
    });
    await this.logout?.revokeSubject(subjectId);
  }

  async enable(subjectId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const enabledAt = new Date();
      const [updated] = await tx
        .update(user)
        .set({
          identityDisabledAt: null,
          identityDisabledReason: null,
          updatedAt: enabledAt,
        })
        .where(
          and(
            eq(user.id, subjectId),
            isNotNull(user.identityDisabledAt),
            isNull(user.mergedIntoSubjectId),
          ),
        )
        .returning({ id: user.id });
      if (!updated) {
        const existing = await tx.query.user.findFirst({
          where: eq(user.id, subjectId),
          columns: { id: true, mergedIntoSubjectId: true },
        });
        if (!existing) throw new IdentityLifecycleConflictError("subject_not_found");
        if (existing.mergedIntoSubjectId) {
          throw new IdentityLifecycleConflictError("invalid_merge");
        }
        return;
      }

      await this.identityEventPublisher.publish(
        { type: "user.identity_enabled", userId: subjectId },
        { producer: "apps/auth", transaction: tx },
      );
    });
  }

  async merge(retiredSubjectId: string, canonicalSubjectId: string): Promise<void> {
    if (retiredSubjectId === canonicalSubjectId) {
      throw new IdentityLifecycleConflictError("invalid_merge");
    }

    await this.db.transaction(async (tx) => {
      const subjects = await tx
        .select({
          id: user.id,
          identityDisabledAt: user.identityDisabledAt,
          mergedIntoSubjectId: user.mergedIntoSubjectId,
        })
        .from(user)
        .where(inArray(user.id, [canonicalSubjectId, retiredSubjectId]))
        .for("update");
      const canonical = subjects.find((subject) => subject.id === canonicalSubjectId);
      const retired = subjects.find((subject) => subject.id === retiredSubjectId);
      if (!canonical || !retired) {
        throw new IdentityLifecycleConflictError("subject_not_found");
      }
      if (retired.mergedIntoSubjectId === canonicalSubjectId) return;
      if (
        canonical.identityDisabledAt ||
        canonical.mergedIntoSubjectId ||
        retired.mergedIntoSubjectId
      ) {
        throw new IdentityLifecycleConflictError("invalid_merge");
      }

      // Authentication methods follow the canonical subject. Product rows keep
      // their original FK and resolve the alias through the merge event.
      const canonicalAccounts = await tx
        .select({ id: account.id, accountId: account.accountId, providerId: account.providerId })
        .from(account)
        .where(eq(account.userId, canonicalSubjectId));
      const retiredAccounts = await tx
        .select({ id: account.id, accountId: account.accountId, providerId: account.providerId })
        .from(account)
        .where(eq(account.userId, retiredSubjectId));
      for (const retiredAccount of retiredAccounts) {
        const conflict = canonicalAccounts.find(
          (candidate) => candidate.providerId === retiredAccount.providerId,
        );
        if (conflict && conflict.accountId !== retiredAccount.accountId) {
          throw new IdentityLifecycleConflictError("invalid_merge");
        }
        if (conflict) {
          await tx.delete(account).where(eq(account.id, retiredAccount.id));
        } else {
          await tx
            .update(account)
            .set({ userId: canonicalSubjectId, updatedAt: new Date() })
            .where(eq(account.id, retiredAccount.id));
        }
      }
      // Product-owned externalAccount rows keep their original FK; merge projectors
      // rewrite userId when handling user.identity_merged.
      await tx
        .update(oauthConsent)
        .set({ userId: canonicalSubjectId, updatedAt: new Date() })
        .where(eq(oauthConsent.userId, retiredSubjectId));
      await tx.delete(oauthAccessToken).where(eq(oauthAccessToken.userId, retiredSubjectId));
      await tx.delete(session).where(eq(session.userId, retiredSubjectId));

      const mergedAt = new Date();
      await tx
        .update(user)
        .set({
          identityDisabledAt: mergedAt,
          identityDisabledReason: "merged",
          mergedIntoSubjectId: canonicalSubjectId,
          updatedAt: mergedAt,
        })
        .where(eq(user.id, retiredSubjectId));

      await this.identityEventPublisher.publish(
        {
          type: "user.identity_merged",
          retiredSubjectId,
          canonicalSubjectId,
        },
        { producer: "apps/auth", transaction: tx },
      );
    });
    await this.logout?.revokeSubject(retiredSubjectId);
  }
}
