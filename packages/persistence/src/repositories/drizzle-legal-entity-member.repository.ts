import type { Database } from "@auction/db";
import { bidIdentityDirectory, legalEntityMember } from "@auction/db/schema";
import type { LegalEntityMember, LegalEntityMemberRole } from "@auction/types";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type {
  ILegalEntityMemberRepository,
  MemberWithUser,
} from "../interfaces/legal-entity-member.repository.js";
import { rowToLegalEntityMember } from "../lib/legal-entity-member.mapper.js";
import { MemberPermissionError } from "../lib/member-permission.error.js";

export class DrizzleLegalEntityMemberRepository implements ILegalEntityMemberRepository {
  constructor(private readonly db: Database) {}

  async listMembersWithUsers(legalEntityId: string): Promise<MemberWithUser[]> {
    const rows = await this.db
      .select({
        member: legalEntityMember,
        user: {
          id: legalEntityMember.userId,
          email: sql<string>`coalesce(${bidIdentityDirectory.email}, '[deleted]')`,
          name: sql<string>`coalesce(${bidIdentityDirectory.name}, 'Deleted user')`,
          image: bidIdentityDirectory.image,
        },
      })
      .from(legalEntityMember)
      .leftJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, legalEntityMember.userId))
      .where(
        and(
          eq(legalEntityMember.legalEntityId, legalEntityId),
          isNull(legalEntityMember.removedAt),
        ),
      )
      .orderBy(desc(legalEntityMember.isPrimaryAdmin), legalEntityMember.createdAt);
    return rows.map((r) => ({
      ...rowToLegalEntityMember(r.member),
      user: { ...r.user, image: r.user.image ?? null },
    }));
  }

  async findMemberById(memberId: string) {
    const rows = await this.db
      .select()
      .from(legalEntityMember)
      .where(eq(legalEntityMember.id, memberId))
      .limit(1);
    return rows[0] ?? null;
  }

  async findActiveMemberConfirmationContext(memberId: string, legalEntityId: string) {
    const [row] = await this.db
      .select({
        role: legalEntityMember.role,
        memberName: bidIdentityDirectory.name,
      })
      .from(legalEntityMember)
      .innerJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, legalEntityMember.userId))
      .where(
        and(
          eq(legalEntityMember.id, memberId),
          eq(legalEntityMember.legalEntityId, legalEntityId),
          isNull(legalEntityMember.removedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findActiveMembership(actingUserId: string, legalEntityId: string) {
    const rows = await this.db
      .select()
      .from(legalEntityMember)
      .where(
        and(
          eq(legalEntityMember.userId, actingUserId),
          eq(legalEntityMember.legalEntityId, legalEntityId),
          isNull(legalEntityMember.removedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  lockActiveMembers(tx: Database, legalEntityId: string) {
    return tx
      .select()
      .from(legalEntityMember)
      .where(
        and(
          eq(legalEntityMember.legalEntityId, legalEntityId),
          isNull(legalEntityMember.removedAt),
        ),
      )
      .orderBy(legalEntityMember.createdAt)
      .for("update");
  }

  async updateRole(
    tx: Database,
    memberId: string,
    change: { role: LegalEntityMemberRole; isPrimaryAdmin: boolean },
  ): Promise<LegalEntityMember> {
    const [updated] = await tx
      .update(legalEntityMember)
      .set({ role: change.role, isPrimaryAdmin: change.isPrimaryAdmin })
      .where(eq(legalEntityMember.id, memberId))
      .returning();
    if (!updated) throw new MemberPermissionError("member_update_failed");
    return rowToLegalEntityMember(updated);
  }

  async markRemoved(tx: Database, memberId: string): Promise<void> {
    await tx
      .update(legalEntityMember)
      .set({ removedAt: new Date() })
      .where(eq(legalEntityMember.id, memberId));
  }
}
