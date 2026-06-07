import type { Database } from "@auction/db";
import { session, user, type userStaffRoleEnum } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import { count, desc, eq, inArray } from "drizzle-orm";
import type { AuthAuditPublisher } from "../services/auth-audit.publisher.js";
import type {
  AdminActivityEntry,
  AdminUserDetail,
  AdminUserListFilter,
  AdminUserListResult,
  AdminUserListRow,
  IAdminUserActivityReader,
  IAdminUserReader,
  IAdminUserRoleManager,
  IAdminUserSuspender,
} from "../services/interfaces/admin-user.js";
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

export class DrizzleAdminUserSuspender implements IAdminUserSuspender {
  constructor(
    private readonly db: Database,
    private readonly sessions: { revokeAllForUser: (userId: string) => Promise<unknown> },
    private readonly hooks?: {
      authAudit?: AuthAuditPublisher;
      emailService?: IEmailService;
      accountSuspendedSupportEmail?: string;
    },
  ) {}

  async suspend(userId: string, reason: string | null): Promise<void> {
    const [before] = await this.db
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    await this.db
      .update(user)
      .set({
        suspendedAt: new Date(),
        suspendedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
    await this.sessions.revokeAllForUser(userId);

    void this.hooks?.authAudit
      ?.publish(this.db, {
        eventType: "auth.account_suspended",
        aggregateId: userId,
        payload: {},
        actorUserId: null,
      })
      .catch(() => {});

    if (before?.email && this.hooks?.emailService) {
      void this.hooks.emailService.enqueue({
        template: "account-suspended",
        to: before.email,
        userId,
        category: "auth",
        vars: {
          userName: before.name,
          supportContactEmail: this.hooks?.accountSuspendedSupportEmail ?? "support@lax.bid",
        },
      });
    }
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
