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

const ADMIN_ROLES: LegalEntityMemberRole[] = ["owner", "admin"];

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

  async findActiveAdminMembership(actingUserId: string, legalEntityId: string) {
    const me = await this.findActiveMembership(actingUserId, legalEntityId);
    if (!me || !me.acceptedAt) {
      throw new MemberPermissionError("not_a_member");
    }
    if (!ADMIN_ROLES.includes(me.role)) {
      throw new MemberPermissionError("insufficient_role");
    }
    return me;
  }

  async updateRole(memberId: string, role: LegalEntityMemberRole): Promise<LegalEntityMember> {
    const [updated] = await this.db
      .update(legalEntityMember)
      .set({ role })
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

  async demotePrimaryAdmin(tx: Database, memberId: string): Promise<LegalEntityMember> {
    const [from] = await tx
      .update(legalEntityMember)
      .set({ isPrimaryAdmin: false, role: "admin" })
      .where(eq(legalEntityMember.id, memberId))
      .returning();
    if (!from) throw new MemberPermissionError("transfer_demote_failed");
    return rowToLegalEntityMember(from);
  }

  async promotePrimaryAdmin(tx: Database, memberId: string): Promise<LegalEntityMember> {
    const [to] = await tx
      .update(legalEntityMember)
      .set({ isPrimaryAdmin: true, role: "owner" })
      .where(eq(legalEntityMember.id, memberId))
      .returning();
    if (!to) throw new MemberPermissionError("transfer_promote_failed");
    return rowToLegalEntityMember(to);
  }
}
