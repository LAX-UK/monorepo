import type { IdentityDatabase } from "@auction/identity-db";
import {
  account,
  oauthAccessToken,
  oauthConsent,
  session,
  user,
} from "@auction/identity-db/schema";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type {
  IIdentityLifecycleRepository,
  IdentityLifecycleMutationOutcome,
  IdentityLifecycleTransaction,
} from "../services/identity-lifecycle.ports.js";

function transactionDb(transaction: IdentityLifecycleTransaction): IdentityDatabase {
  return transaction as IdentityDatabase;
}

export class DrizzleIdentityLifecycleRepository implements IIdentityLifecycleRepository {
  constructor(private readonly db: IdentityDatabase) {}

  transaction(
    operation: (transaction: IdentityLifecycleTransaction) => Promise<void>,
  ): Promise<void> {
    return this.db.transaction(operation);
  }

  async disableSubject(
    transaction: IdentityLifecycleTransaction,
    input: {
      subjectId: string;
      reason: string | null;
      now: Date;
    },
  ): Promise<IdentityLifecycleMutationOutcome> {
    const tx = transactionDb(transaction);
    const [updated] = await tx
      .update(user)
      .set({
        identityDisabledAt: input.now,
        identityDisabledReason: input.reason,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(user.id, input.subjectId),
          isNull(user.identityDisabledAt),
          isNull(user.mergedIntoSubjectId),
        ),
      )
      .returning({ id: user.id });
    if (!updated) {
      const existing = await tx.query.user.findFirst({
        where: eq(user.id, input.subjectId),
        columns: { id: true, mergedIntoSubjectId: true },
      });
      if (!existing) return "not_found";
      return existing.mergedIntoSubjectId ? "invalid_merge" : "unchanged";
    }

    await tx.delete(session).where(eq(session.userId, input.subjectId));
    await tx.delete(oauthAccessToken).where(eq(oauthAccessToken.userId, input.subjectId));
    return "updated";
  }

  async enableSubject(
    transaction: IdentityLifecycleTransaction,
    input: {
      subjectId: string;
      now: Date;
    },
  ): Promise<IdentityLifecycleMutationOutcome> {
    const tx = transactionDb(transaction);
    const [updated] = await tx
      .update(user)
      .set({
        identityDisabledAt: null,
        identityDisabledReason: null,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(user.id, input.subjectId),
          isNotNull(user.identityDisabledAt),
          isNull(user.mergedIntoSubjectId),
        ),
      )
      .returning({ id: user.id });
    if (updated) return "updated";

    const existing = await tx.query.user.findFirst({
      where: eq(user.id, input.subjectId),
      columns: { id: true, mergedIntoSubjectId: true },
    });
    if (!existing) return "not_found";
    return existing.mergedIntoSubjectId ? "invalid_merge" : "unchanged";
  }

  async mergeSubjects(
    transaction: IdentityLifecycleTransaction,
    input: {
      retiredSubjectId: string;
      canonicalSubjectId: string;
      now: Date;
    },
  ): Promise<IdentityLifecycleMutationOutcome> {
    const tx = transactionDb(transaction);
    const subjects = await tx
      .select({
        id: user.id,
        identityDisabledAt: user.identityDisabledAt,
        mergedIntoSubjectId: user.mergedIntoSubjectId,
      })
      .from(user)
      .where(inArray(user.id, [input.canonicalSubjectId, input.retiredSubjectId]))
      .for("update");
    const canonical = subjects.find((subject) => subject.id === input.canonicalSubjectId);
    const retired = subjects.find((subject) => subject.id === input.retiredSubjectId);
    if (!canonical || !retired) return "not_found";
    if (retired.mergedIntoSubjectId === input.canonicalSubjectId) return "unchanged";
    if (
      canonical.identityDisabledAt ||
      canonical.mergedIntoSubjectId ||
      retired.mergedIntoSubjectId
    ) {
      return "invalid_merge";
    }

    // Authentication methods follow the canonical subject. Product rows keep
    // their original FK and resolve the alias through the merge event.
    const canonicalAccounts = await tx
      .select({ id: account.id, accountId: account.accountId, providerId: account.providerId })
      .from(account)
      .where(eq(account.userId, input.canonicalSubjectId));
    const retiredAccounts = await tx
      .select({ id: account.id, accountId: account.accountId, providerId: account.providerId })
      .from(account)
      .where(eq(account.userId, input.retiredSubjectId));
    for (const retiredAccount of retiredAccounts) {
      const conflict = canonicalAccounts.find(
        (candidate) => candidate.providerId === retiredAccount.providerId,
      );
      if (conflict && conflict.accountId !== retiredAccount.accountId) {
        return "invalid_merge";
      }
      if (conflict) {
        await tx.delete(account).where(eq(account.id, retiredAccount.id));
      } else {
        await tx
          .update(account)
          .set({ userId: input.canonicalSubjectId, updatedAt: input.now })
          .where(eq(account.id, retiredAccount.id));
      }
    }

    // Product-owned externalAccount rows keep their original FK; merge projectors
    // rewrite userId when handling user.identity_merged.
    await tx
      .update(oauthConsent)
      .set({ userId: input.canonicalSubjectId, updatedAt: input.now })
      .where(eq(oauthConsent.userId, input.retiredSubjectId));
    await tx.delete(oauthAccessToken).where(eq(oauthAccessToken.userId, input.retiredSubjectId));
    await tx.delete(session).where(eq(session.userId, input.retiredSubjectId));
    await tx
      .update(user)
      .set({
        identityDisabledAt: input.now,
        identityDisabledReason: "merged",
        mergedIntoSubjectId: input.canonicalSubjectId,
        updatedAt: input.now,
      })
      .where(eq(user.id, input.retiredSubjectId));
    return "updated";
  }
}
