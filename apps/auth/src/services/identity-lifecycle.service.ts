import {
  type Database,
  publishUserIdentityDisabled,
  publishUserIdentityEnabled,
  publishUserIdentityMerged,
} from "@auction/db";
import {
  account,
  externalAccount,
  oauthAccessToken,
  oauthConsent,
  session,
  user,
} from "@auction/db/schema";
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
      await publishUserIdentityDisabled(
        tx,
        {
          subjectId,
          disabledAt: (updated.disabledAt ?? new Date()).toISOString(),
          ...(reason?.trim() ? { reason: reason.trim() } : {}),
        },
        { producer: "apps/auth" },
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

      await publishUserIdentityEnabled(
        tx,
        { subjectId, enabledAt: enabledAt.toISOString() },
        { producer: "apps/auth" },
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
      await tx
        .update(externalAccount)
        .set({ userId: canonicalSubjectId })
        .where(eq(externalAccount.userId, retiredSubjectId));
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

      await publishUserIdentityMerged(
        tx,
        {
          subjectId: canonicalSubjectId,
          retiredSubjectId,
          mergedAt: mergedAt.toISOString(),
        },
        { producer: "apps/auth" },
      );
    });
    await this.logout?.revokeSubject(retiredSubjectId);
  }
}
