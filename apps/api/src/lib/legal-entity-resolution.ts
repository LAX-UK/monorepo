import type { Database } from "@auction/db";
import { legalEntity, legalEntityMember } from "@auction/db/schema";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";

/** Active owner membership on the user's personal `individual` entity (matches legal-entity repo). */
function personalEntityMembershipJoin(userId: string) {
  return and(
    eq(legalEntityMember.legalEntityId, legalEntity.id),
    eq(legalEntityMember.userId, userId),
    eq(legalEntityMember.role, "owner"),
    isNull(legalEntityMember.removedAt),
    isNotNull(legalEntityMember.acceptedAt),
  );
}

/** Resolves a user's individual legal entity ID.
 * During the dual-write period, this is used to populate the new
 * legal_entity_id columns when only the user_id is available.
 */
export async function resolveUserIndividualEntity(
  db: Database,
  userId: string,
): Promise<string | null> {
  const rows = await db
    .select({ entityId: legalEntity.id })
    .from(legalEntity)
    .innerJoin(legalEntityMember, personalEntityMembershipJoin(userId))
    .where(and(eq(legalEntity.kind, "individual"), eq(legalEntity.createdByUserId, userId)))
    .limit(1);

  return rows[0]?.entityId ?? null;
}

/** Batch resolve multiple user IDs to their individual entity IDs. */
export async function resolveUserIndividualEntities(
  db: Database,
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();

  const rows = await db
    .select({
      userId: legalEntity.createdByUserId,
      entityId: legalEntity.id,
    })
    .from(legalEntity)
    .innerJoin(
      legalEntityMember,
      and(
        eq(legalEntityMember.legalEntityId, legalEntity.id),
        eq(legalEntityMember.userId, legalEntity.createdByUserId),
        eq(legalEntityMember.role, "owner"),
        isNull(legalEntityMember.removedAt),
        isNotNull(legalEntityMember.acceptedAt),
      ),
    )
    .where(and(eq(legalEntity.kind, "individual"), inArray(legalEntity.createdByUserId, userIds)));

  return new Map(rows.map((r) => [r.userId, r.entityId]));
}
