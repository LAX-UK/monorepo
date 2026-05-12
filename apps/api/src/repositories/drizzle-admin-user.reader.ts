import type { Database } from "@auction/db";
import { session, user, type userStaffRoleEnum } from "@auction/db/schema";
import { count, desc, eq, ilike, or } from "drizzle-orm";
import type {
  AdminActivityEntry,
  AdminUserDetail,
  AdminUserListFilter,
  AdminUserListResult,
  IAdminUserActivityReader,
  IAdminUserReader,
  IAdminUserRoleManager,
  IAdminUserSuspender,
} from "../services/interfaces/admin-user.js";

export class DrizzleAdminUserReader implements IAdminUserReader {
  constructor(private readonly db: Database) {}

  async list(filter: AdminUserListFilter): Promise<AdminUserListResult> {
    const q = filter.q?.trim();
    const whereClause = q ? or(ilike(user.email, `%${q}%`), ilike(user.name, `%${q}%`)) : undefined;

    const countQuery = this.db.select({ n: count() }).from(user);
    const [countRow] = whereClause ? await countQuery.where(whereClause) : await countQuery;
    const total = Number(countRow?.n ?? 0);

    const base = this.db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        staffRole: user.staffRole,
        createdAt: user.createdAt,
        suspendedAt: user.suspendedAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt))
      .limit(filter.limit)
      .offset(filter.offset);

    const rows = whereClause ? await base.where(whereClause) : await base;

    return {
      total,
      rows: rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        role: r.role,
        staffRole: r.staffRole ?? null,
        createdAt: r.createdAt,
        suspendedAt: r.suspendedAt ?? null,
      })),
    };
  }

  async getById(id: string): Promise<AdminUserDetail | null> {
    const [row] = await this.db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        staffRole: user.staffRole,
        createdAt: user.createdAt,
        suspendedAt: user.suspendedAt,
        suspendedReason: user.suspendedReason,
      })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      staffRole: row.staffRole ?? null,
      createdAt: row.createdAt,
      suspendedAt: row.suspendedAt ?? null,
      suspendedReason: row.suspendedReason ?? null,
    };
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

export class DrizzleAdminUserSuspender implements IAdminUserSuspender {
  constructor(private readonly db: Database) {}

  async suspend(userId: string, reason: string | null): Promise<void> {
    await this.db
      .update(user)
      .set({
        suspendedAt: new Date(),
        suspendedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
  }

  async unsuspend(userId: string): Promise<void> {
    await this.db
      .update(user)
      .set({
        suspendedAt: null,
        suspendedReason: null,
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
