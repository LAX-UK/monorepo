import type { Database } from "@auction/db";
import { legalEntity, user, userInvitation } from "@auction/db/schema";
import type { LegalEntityMemberRole } from "@auction/types";
import { and, eq, gt, isNotNull, sql } from "drizzle-orm";
import type {
  IPendingInvitationsReader,
  PendingInvitationView,
} from "../services/interfaces/pending-invitations-reader.js";

export class DrizzlePendingInvitationsReader implements IPendingInvitationsReader {
  constructor(private readonly db: Database) {}

  async listForEmail(email: string, now: Date): Promise<PendingInvitationView[]> {
    const norm = email.trim().toLowerCase();
    const rows = await this.db
      .select({
        id: userInvitation.id,
        email: userInvitation.email,
        expiresAt: userInvitation.expiresAt,
        legalEntityId: userInvitation.targetLegalEntityId,
        orgDisplayName: legalEntity.displayName,
        orgSubkind: legalEntity.subkind,
        inviterUserId: userInvitation.createdByUserId,
        inviterName: user.name,
        roleOffered: userInvitation.targetLegalEntityMemberRole,
      })
      .from(userInvitation)
      .innerJoin(legalEntity, eq(legalEntity.id, userInvitation.targetLegalEntityId))
      .innerJoin(user, eq(user.id, userInvitation.createdByUserId))
      .where(
        and(
          eq(sql`lower(${userInvitation.email})`, norm),
          eq(userInvitation.status, "pending"),
          gt(userInvitation.expiresAt, now),
          isNotNull(userInvitation.targetLegalEntityId),
          isNotNull(userInvitation.targetLegalEntityMemberRole),
        ),
      )
      .orderBy(userInvitation.expiresAt);

    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      expiresAt: r.expiresAt.toISOString(),
      legalEntityId: r.legalEntityId as string,
      orgDisplayName: r.orgDisplayName,
      orgSubkind: r.orgSubkind,
      inviterUserId: r.inviterUserId,
      inviterName: r.inviterName ?? "",
      roleOffered: r.roleOffered as LegalEntityMemberRole,
    }));
  }
}
