import type { Database } from "@auction/db";
import { session, user, userStaffRoleEnum } from "@auction/db/schema";
import { count, desc, eq, inArray, sql } from "drizzle-orm";
import type {
  AdminActivityEntry,
  AdminUserDetail,
  AdminUserListFilter,
  AdminUserListResult,
  AdminUserListRow,
  AdminUserListSummary,
  IAdminUserActivityReader,
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

    const countQuery = this.db.select({ n: count() }).from(user);
    const [countRow] = whereClause ? await countQuery.where(whereClause) : await countQuery;
    const total = Number(countRow?.n ?? 0);

    const base = this.db
      .select(adminUserListSelect)
      .from(user)
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
        sql<number>`count(*) filter (where ${user.staffRole} = ${role})::int`,
      ]),
    );
    const countBase = this.db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${user.suspendedAt} is null)::int`,
        suspended: sql<number>`count(*) filter (where ${user.suspendedAt} is not null)::int`,
        emailVerified: sql<number>`count(*) filter (where ${user.emailVerified} = true)::int`,
        kycVerified: sql<number>`count(*) filter (where ${user.kycStatus} = 'approved')::int`,
        legacyStaffRole: sql<number>`count(*) filter (where ${user.role} = 'staff' and ${user.staffRole} is null)::int`,
        ...staffRoleCountSelect,
      })
      .from(user);
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
        suspendedReason: user.suspendedReason,
        dateOfBirth: user.dateOfBirth,
        emailStatusChangedAt: user.emailStatusChangedAt,
        pendingNewEmail: user.pendingNewEmail,
        emailChangeExpiresAt: user.emailChangeExpiresAt,
        currentKycSessionId: user.currentKycSessionId,
        amlHoldStatus: user.amlHoldStatus,
        amlHoldReason: user.amlHoldReason,
        amlHoldAt: user.amlHoldAt,
      })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);
    if (!row) return null;
    return {
      ...mapAdminUserListRow(row),
      suspendedReason: row.suspendedReason ?? null,
      dateOfBirth: row.dateOfBirth ?? null,
      emailStatusChangedAt: row.emailStatusChangedAt ?? null,
      pendingNewEmail: row.pendingNewEmail ?? null,
      emailChangeExpiresAt: row.emailChangeExpiresAt ?? null,
      currentKycSessionId: row.currentKycSessionId ?? null,
      amlHoldStatus: row.amlHoldStatus ?? null,
      amlHoldReason: row.amlHoldReason ?? null,
      amlHoldAt: row.amlHoldAt ?? null,
    };
  }

  async getByIds(ids: string[]): Promise<AdminUserListRow[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.select(adminUserListSelect).from(user).where(inArray(user.id, ids));
    return rows.map(mapAdminUserListRow);
  }
}

export class DrizzleAdminUserRoleManager implements IAdminUserRoleManager {
  constructor(private readonly db: Database) {}

  async setRoleAndStaff(userId: string, role: string, staffRole: string | null): Promise<void> {
    if (role === "client") {
      await this.db
        .update(user)
        .set({ role: "client", staffRole: null, updatedAt: new Date() })
        .where(eq(user.id, userId));
      return;
    }
    const value =
      staffRole === null || staffRole === ""
        ? null
        : (staffRole as (typeof userStaffRoleEnum.enumValues)[number]);
    await this.db
      .update(user)
      .set({
        role: "staff",
        staffRole: value,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
  }
}

export class DrizzleAdminUserActivityReader implements IAdminUserActivityReader {
  constructor(private readonly db: Database) {}

  async getRecentSessions(userId: string, limit: number): Promise<AdminActivityEntry[]> {
    const rows = await this.db
      .select({
        id: session.id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
      })
      .from(session)
      .where(eq(session.userId, userId))
      .orderBy(desc(session.createdAt))
      .limit(Math.min(100, Math.max(1, limit)));

    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      ipAddress: r.ipAddress ?? null,
    }));
  }
}
