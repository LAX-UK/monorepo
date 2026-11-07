import type { Database } from "@auction/db";
import { shopUserProfile } from "@auction/db/schema";
import { deletedUserPseudonym } from "@auction/types";
import { eq } from "drizzle-orm";
import {
  SHOP_ANONYMISATION_RULES,
  type ShopAnonymisationRule,
  type ShopAnonymisationScope,
} from "./shop-personal-data-policy.js";

/** Rows changed per table. Tables with nothing to change are left out, so the audit stays short. */
export type ShopAnonymisationCounts = Record<string, number>;

/** Resolves who the purge covers: the subject and every alias merged into it. */
export async function resolveShopAnonymisationScope(
  tx: Database,
  subjectId: string,
  now: Date,
): Promise<ShopAnonymisationScope> {
  const aliases = await tx
    .select({ id: shopUserProfile.identitySubjectId })
    .from(shopUserProfile)
    .where(eq(shopUserProfile.mergedIntoSubjectId, subjectId));
  return {
    subjectId,
    subjectIds: [subjectId, ...aliases.map((alias) => alias.id)],
    pseudonym: deletedUserPseudonym(subjectId),
    now,
  };
}

/**
 * Anonymises everything Shop holds about one purged person, following the policy. Every rule is a
 * delete or a set-to-fixed-value, so running it again changes nothing further and a retry after a
 * crash is safe.
 */
export async function anonymiseShopPersonalData(
  tx: Database,
  subjectId: string,
  now: Date,
  rules: readonly ShopAnonymisationRule[] = SHOP_ANONYMISATION_RULES,
): Promise<ShopAnonymisationCounts> {
  const scope = await resolveShopAnonymisationScope(tx, subjectId, now);
  const counts: ShopAnonymisationCounts = {};
  for (const rule of rules) {
    const changed = await rule.apply(tx, scope);
    const byTable = typeof changed === "number" ? { [rule.table]: changed } : changed;
    for (const [table, count] of Object.entries(byTable)) {
      if (count > 0) counts[table] = count;
    }
  }
  return counts;
}
