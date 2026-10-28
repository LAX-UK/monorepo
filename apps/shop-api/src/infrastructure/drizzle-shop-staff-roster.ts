import type { Database } from "@auction/db";
import { shopStaffMember, shopStaffRoleAssignment } from "@auction/db/schema";
import type { ShopStaffRole } from "@auction/shop-domain";
import { and, asc, eq, gt, isNull, lte, ne, or, sql } from "drizzle-orm";
import type {
  NewShopStaffRoleAssignment,
  ShopStaffRoleAssignmentRecord,
  ShopStaffRoster,
  ShopStaffRosterAuditEntry,
  ShopStaffRosterTransaction,
} from "../application/ports/shop-staff-roster.js";
import { insertShopAdminAudit } from "./shop-admin-audit.js";

const SHOP_ADMIN_ROSTER_LOCK_KEY = "shop_staff_admin_roster";

type Row = typeof shopStaffRoleAssignment.$inferSelect;

function toRecord(row: Row): ShopStaffRoleAssignmentRecord {
  return {
    id: row.id,
    subjectId: row.identitySubjectId,
    role: row.role,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    grantedBySubjectId: row.grantedBySubjectId,
    grantedAt: row.grantedAt,
    reason: row.reason,
    endRecordedAt: row.endRecordedAt,
  };
}

/** Not ended at `now`: open, or ending later. */
const notEndedAt = (now: Date) =>
  or(isNull(shopStaffRoleAssignment.endsAt), gt(shopStaffRoleAssignment.endsAt, now));

function rosterTransaction(tx: Database): ShopStaffRosterTransaction {
  return {
    async listCurrent(subjectId, now) {
      const rows = await tx
        .select()
        .from(shopStaffRoleAssignment)
        .where(and(eq(shopStaffRoleAssignment.identitySubjectId, subjectId), notEndedAt(now)))
        .orderBy(asc(shopStaffRoleAssignment.startsAt))
        .for("update");
      return rows.map(toRecord);
    },

    async countOtherActiveAdministrators(subjectId, now) {
      const [row] = await tx
        .select({
          count: sql<number>`count(distinct ${shopStaffRoleAssignment.identitySubjectId})::int`,
        })
        .from(shopStaffRoleAssignment)
        .innerJoin(
          shopStaffMember,
          eq(shopStaffMember.identitySubjectId, shopStaffRoleAssignment.identitySubjectId),
        )
        .where(
          and(
            eq(shopStaffRoleAssignment.role, "shop_admin"),
            ne(shopStaffRoleAssignment.identitySubjectId, subjectId),
            lte(shopStaffRoleAssignment.startsAt, now),
            notEndedAt(now),
            isNull(shopStaffMember.disabledAt),
          ),
        );
      return row?.count ?? 0;
    },

    async findById(assignmentId) {
      const [row] = await tx
        .select()
        .from(shopStaffRoleAssignment)
        .where(eq(shopStaffRoleAssignment.id, assignmentId))
        .limit(1)
        .for("update");
      return row ? toRecord(row) : null;
    },

    async ensureMember(subjectId, role) {
      await tx
        .insert(shopStaffMember)
        .values({ identitySubjectId: subjectId, role })
        .onConflictDoNothing({ target: shopStaffMember.identitySubjectId });
    },

    async insert(assignment: NewShopStaffRoleAssignment) {
      const [row] = await tx
        .insert(shopStaffRoleAssignment)
        .values({
          identitySubjectId: assignment.subjectId,
          role: assignment.role,
          startsAt: assignment.startsAt,
          endsAt: assignment.endsAt,
          grantedBySubjectId: assignment.grantedBySubjectId,
          reason: assignment.reason,
          grantedEventId: assignment.grantedEventId,
        })
        .returning();
      if (!row) throw new Error("shop staff role assignment was not written");
      return toRecord(row);
    },

    async end(assignmentId, endsAt, endedEventId) {
      await tx
        .update(shopStaffRoleAssignment)
        .set({ endsAt, endRecordedAt: endsAt, endedEventId })
        .where(eq(shopStaffRoleAssignment.id, assignmentId));
    },

    async recordEnd(assignmentId, at, endedEventId) {
      await tx
        .update(shopStaffRoleAssignment)
        .set({ endRecordedAt: at, endedEventId })
        .where(
          and(
            eq(shopStaffRoleAssignment.id, assignmentId),
            isNull(shopStaffRoleAssignment.endRecordedAt),
          ),
        );
    },

    async writeMember(subjectId, primaryRole: ShopStaffRole | null, now) {
      await tx
        .update(shopStaffMember)
        .set(primaryRole ? { role: primaryRole, disabledAt: null } : { disabledAt: now })
        .where(eq(shopStaffMember.identitySubjectId, subjectId));
    },

    async audit(entry: ShopStaffRosterAuditEntry) {
      await insertShopAdminAudit(tx, {
        actorSubjectId: entry.actorSubjectId,
        capability: "settings.write",
        action: entry.action,
        targetType: "shop_staff_role_assignment",
        targetId: entry.assignmentId,
        ...(entry.before ? { beforeJson: entry.before } : {}),
        afterJson: entry.after,
      });
    },
  };
}

/**
 * LAX Admin's roster in Postgres. Each change runs in its own transaction (a savepoint inside a
 * caller's) under one advisory lock, so roster rules see every other change in full.
 */
export function createDrizzleShopStaffRoster(db: Database): ShopStaffRoster {
  return {
    transact: (work) =>
      db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${SHOP_ADMIN_ROSTER_LOCK_KEY}))`,
        );
        return work(rosterTransaction(tx as unknown as Database));
      }),
  };
}
