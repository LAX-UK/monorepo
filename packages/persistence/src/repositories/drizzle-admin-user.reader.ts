import type { Database } from "@auction/db";
import { bidIdentityDirectory, bidUserProfile, userStaffRoleEnum } from "@auction/db/schema";
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { writeBidUserProfile } from "../bid-user-profile-sync.js";
import type {
  AdminUserDetail,
  AdminUserListFilter,
  AdminUserListResult,
  AdminUserListRow,
  AdminUserListSummary,
  IAdminUserReader,
  IAdminUserRoleManager,
} from "../interfaces/admin-user.repository.js";
import { LastSuperAdminError } from "../interfaces/admin-user.repository.js";
import {
  adminUserListSelect,
  buildAdminUserListOrderBy,
  buildAdminUserListWhere,
  mapAdminUserListRow,
} from "./admin-user-list-sql.js";
import { insertLaxStaffAccessEvents } from "./drizzle-lax-staff-access.repository.js";

export class DrizzleAdminUserReader implements IAdminUserReader {
  constructor(private readonly db: Database) {}

  async list(filter: AdminUserListFilter): Promise<AdminUserListResult> {
    const whereClause = buildAdminUserListWhere(filter);

    const countQuery = this.db
      .select({ n: count() })
      .from(bidIdentityDirectory)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId));
    const [countRow] = whereClause ? await countQuery.where(whereClause) : await countQuery;
    const total = Number(countRow?.n ?? 0);

    const base = this.db
      .select(adminUserListSelect)
      .from(bidIdentityDirectory)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .orderBy(buildAdminUserListOrderBy(filter.sort))
      .limit(filter.limit)
      .offset(filter.offset);

    const rows = whereClause ? await base.where(whereClause) : await base;

    return {
      total,
      rows: rows.map(mapAdminUserListRow),
    };
  }

  async summarize(filter: AdminUserListFilter): Promise<AdminUserListSummary> {
    const whereClause = buildAdminUserListWhere(filter);
    const staffRoleCountSelect = Object.fromEntries(
      userStaffRoleEnum.enumValues.map((role) => [
        `role_${role}`,
        sql<number>`count(*) filter (where ${bidUserProfile.staffRole} = ${role})::int`,
      ]),
    );
    const countBase = this.db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${bidUserProfile.suspendedAt} is null)::int`,
        suspended: sql<number>`count(*) filter (where ${bidUserProfile.suspendedAt} is not null)::int`,
        emailVerified: sql<number>`count(*) filter (where ${bidIdentityDirectory.emailVerified} = true)::int`,
        kycVerified: sql<number>`count(*) filter (where ${bidUserProfile.kycStatus} = 'approved')::int`,
        legacyStaffRole: sql<number>`count(*) filter (where ${bidUserProfile.role} = 'staff' and ${bidUserProfile.staffRole} is null)::int`,
        ...staffRoleCountSelect,
      })
      .from(bidIdentityDirectory)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId));
    const [row] = whereClause ? await countBase.where(whereClause) : await countBase;
    const byStaffRole: Record<string, number> = {};
    for (const role of userStaffRoleEnum.enumValues) {
      const key = `role_${role}` as keyof typeof row;
      byStaffRole[role] = Number(row?.[key] ?? 0);
    }
    byStaffRole.legacy = row?.legacyStaffRole ?? 0;
    return {
      total: row?.total ?? 0,
      active: row?.active ?? 0,
      suspended: row?.suspended ?? 0,
      emailVerified: row?.emailVerified ?? 0,
      kycVerified: row?.kycVerified ?? 0,
      byStaffRole,
    };
  }

  async getById(id: string): Promise<AdminUserDetail | null> {
    const [row] = await this.db
      .select({
        ...adminUserListSelect,
        suspendedReason: bidUserProfile.suspendedReason,
        dateOfBirth: bidUserProfile.dateOfBirth,
        emailStatusChangedAt: bidUserProfile.emailStatusChangedAt,
        currentKycSessionId: bidUserProfile.currentKycSessionId,
        amlHoldStatus: bidUserProfile.amlHoldStatus,
        amlHoldReason: bidUserProfile.amlHoldReason,
        amlHoldAt: bidUserProfile.amlHoldAt,
      })
      .from(bidIdentityDirectory)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(eq(bidIdentityDirectory.subjectId, id))
      .limit(1);
    if (!row) return null;
    return {
      ...mapAdminUserListRow(row),
      suspendedReason: row.suspendedReason ?? null,
      dateOfBirth: row.dateOfBirth ?? null,
      emailStatusChangedAt: row.emailStatusChangedAt ?? null,
      pendingNewEmail: null,
      emailChangeExpiresAt: null,
      currentKycSessionId: row.currentKycSessionId ?? null,
      amlHoldStatus: row.amlHoldStatus ?? null,
      amlHoldReason: row.amlHoldReason ?? null,
      amlHoldAt: row.amlHoldAt ?? null,
    };
  }

  async getByIds(ids: string[]): Promise<AdminUserListRow[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select(adminUserListSelect)
      .from(bidIdentityDirectory)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(inArray(bidIdentityDirectory.subjectId, ids));
    return rows.map(mapAdminUserListRow);
  }
}

const STAFF_ROSTER_LOCK_KEY = "bid_staff_admin_roster";

/** True when the change takes super_admin away from someone who holds it. */
export function removesSuperAdmin(
  previous: { role: string; staffRole: string | null } | undefined,
  next: { role: string; staffRole: string | null },
): boolean {
  const heldSuperAdmin = previous?.role === "staff" && previous.staffRole === "super_admin";
  const keepsSuperAdmin = next.role === "staff" && next.staffRole === "super_admin";
  return heldSuperAdmin && !keepsSuperAdmin;
}

export class DrizzleAdminUserRoleManager implements IAdminUserRoleManager {
  constructor(
    private readonly db: Database,
    private readonly producer = "apps/api",
  ) {}

  async setRoleAndStaff(
    userId: string,
    role: string,
    staffRole: string | null,
    actorUserId: string,
  ): Promise<void> {
    const nextStaffRole =
      role === "client" || staffRole === null || staffRole === ""
        ? null
        : (staffRole as (typeof userStaffRoleEnum.enumValues)[number]);
    await this.db.transaction(async (tx) => {
      const [previous] = await tx
        .select({ role: bidUserProfile.role, staffRole: bidUserProfile.staffRole })
        .from(bidUserProfile)
        .where(eq(bidUserProfile.userId, userId))
        .for("update");
      const nextRole = role === "client" ? "client" : "staff";
      if (
        removesSuperAdmin(previous, { role: nextRole, staffRole: nextStaffRole }) &&
        !(await hasAnotherActiveSuperAdmin(tx, userId))
      ) {
        throw new LastSuperAdminError();
      }
      await writeBidUserProfile(tx, userId, {
        role: nextRole,
        staffRole: nextStaffRole,
      });
      const before = previous?.role === "staff" ? (previous.staffRole ?? "staff") : null;
      const after = role === "client" ? null : (nextStaffRole ?? "staff");
      if (before === after) return;
      await insertLaxStaffAccessEvents(tx, this.producer, [
        after === null
          ? {
              type: "lax.staff_access.revoked",
              payload: {
                schemaVersion: 1,
                subjectId: userId,
                product: "bid",
                revokedBySubjectId: actorUserId,
              },
            }
          : {
              type: "lax.staff_access.granted",
              payload: {
                schemaVersion: 1,
                subjectId: userId,
                product: "bid",
                role: after,
                grantedBySubjectId: actorUserId,
                invitationId: null,
              },
            },
      ]);
    });
  }
}

/**
 * Serialises roster changes, then checks someone else still holds an active super_admin. The
 * lock means two admins demoting each other at once cannot both pass.
 */
async function hasAnotherActiveSuperAdmin(tx: Database, excludingUserId: string): Promise<boolean> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${STAFF_ROSTER_LOCK_KEY}))`);
  const [row] = await tx
    .select({ n: count() })
    .from(bidUserProfile)
    .where(
      and(
        eq(bidUserProfile.role, "staff"),
        eq(bidUserProfile.staffRole, "super_admin"),
        isNull(bidUserProfile.suspendedAt),
        sql`${bidUserProfile.userId} <> ${excludingUserId}`,
      ),
    );
  return Number(row?.n ?? 0) > 0;
}
