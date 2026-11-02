import { bidUserProfile, legalEntity } from "@auction/db/schema";
import { deletedUserPseudonym } from "@auction/types";
import { and, eq, inArray } from "drizzle-orm";
import type { ProjectorDbConnection } from "../interfaces/worker-db.types.js";
import {
  BID_ANONYMISATION_RULES,
  type BidAnonymisationRule,
  type BidAnonymisationScope,
} from "./bid-personal-data-policy.js";

/** Rows changed per table. Tables with nothing to change are left out, so the audit stays short. */
export type AnonymisationCounts = Record<string, number>;

/** Resolves who the purge covers: the subject, its merged aliases and its personal accounts. */
export async function resolveBidAnonymisationScope(
  tx: ProjectorDbConnection,
  subjectId: string,
): Promise<BidAnonymisationScope> {
  const aliases = await tx
    .select({ id: bidUserProfile.userId })
    .from(bidUserProfile)
    .where(eq(bidUserProfile.mergedIntoSubjectId, subjectId));
  const subjectIds = [subjectId, ...aliases.map((alias) => alias.id)];
  const personalEntities = await tx
    .select({ id: legalEntity.id })
    .from(legalEntity)
    .where(
      and(inArray(legalEntity.createdByUserId, subjectIds), eq(legalEntity.kind, "individual")),
    );
  return {
    subjectIds,
    personalLegalEntityIds: personalEntities.map((row) => row.id),
    pseudonym: deletedUserPseudonym(subjectId),
  };
}

/**
 * Anonymises everything Bid holds about one purged person, following the policy. Every rule is a
 * delete or a set-to-fixed-value, so running it again changes nothing further and a retry after a
 * crash is safe.
 */
export async function anonymiseBidPersonalData(
  tx: ProjectorDbConnection,
  subjectId: string,
  rules: readonly BidAnonymisationRule[] = BID_ANONYMISATION_RULES,
): Promise<AnonymisationCounts> {
  const scope = await resolveBidAnonymisationScope(tx, subjectId);
  const counts: AnonymisationCounts = {};
  for (const rule of rules) {
    const changed = await rule.apply(tx, scope);
    if (changed > 0) counts[rule.table] = changed;
  }
  return counts;
}
