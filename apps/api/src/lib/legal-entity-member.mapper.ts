import type { legalEntityMember } from "@auction/db/schema";
import type { LegalEntityMember } from "@auction/types";

export function rowToLegalEntityMember(
  row: typeof legalEntityMember.$inferSelect,
): LegalEntityMember {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    userId: row.userId,
    role: row.role,
    isPrimaryAdmin: row.isPrimaryAdmin,
    invitedByUserId: row.invitedByUserId ?? null,
    invitedAt: row.invitedAt ?? null,
    acceptedAt: row.acceptedAt ?? null,
    removedAt: row.removedAt ?? null,
    createdAt: row.createdAt,
  };
}
