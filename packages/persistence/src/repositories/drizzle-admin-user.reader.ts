import type { Database } from "@auction/db";
import { bidIdentityDirectory, bidUserProfile, userStaffRoleEnum } from "@auction/db/schema";
import { count, eq, inArray, sql } from "drizzle-orm";
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
import {
  adminUserListSelect,
  buildAdminUserListOrderBy,
  buildAdminUserListWhere,
  mapAdminUserListRow,
} from "./admin-user-list-sql.js";

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

export class DrizzleAdminUserRoleManager implements IAdminUserRoleManager {
  constructor(private readonly db: Database) {}

  async setRoleAndStaff(userId: string, role: string, staffRole: string | null): Promise<void> {
    if (role === "client") {
      await writeBidUserProfile(this.db, userId, { role: "client", staffRole: null });
      return;
    }
    const value =
      staffRole === null || staffRole === ""
        ? null
        : (staffRole as (typeof userStaffRoleEnum.enumValues)[number]);
    await writeBidUserProfile(this.db, userId, {
      role: "staff",
      staffRole: value,
    });
  }
}
