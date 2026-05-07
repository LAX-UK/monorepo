import type { Database } from "@auction/db";
import { legalEntity, legalEntityMember } from "@auction/db/schema";
import { and, eq, inArray } from "drizzle-orm";

/** Resolves a user's individual legal entity ID.
 * During the dual-write period , this is used to populate the new
 * legal_entity_id columns when only the user_id is available.
 * * Cached per request - this function should be called within a request context
 * and results memoized for the duration of the request.
 */
export async function resolveUserIndividualEntity(
  db: Database,
  userId: string,
): Promise<string | null> {
  const rows = await db
    .select({ entityId: legalEntity.id })
    .from(legalEntity)
    .innerJoin(
      legalEntityMember,
      and(
        eq(legalEntityMember.legalEntityId, legalEntity.id),
        eq(legalEntityMember.userId, userId),
        eq(legalEntityMember.role, "owner"),
        eq(legalEntityMember.isPrimaryAdmin, true),
      ),
    )
    .where(and(eq(legalEntity.kind, "individual"), eq(legalEntity.createdByUserId, userId)))
    .limit(1);

  return rows[0]?.entityId ?? null;
}

/** Batch resolve multiple user IDs to their individual entity IDs.
 * More efficient than calling resolveUserIndividualEntity in a loop.
 */
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
        eq(legalEntityMember.role, "owner"),
        eq(legalEntityMember.isPrimaryAdmin, true),
      ),
    )
    .where(and(eq(legalEntity.kind, "individual"), inArray(legalEntity.createdByUserId, userIds)));

  return new Map(rows.map((r) => [r.userId, r.entityId]));
}
