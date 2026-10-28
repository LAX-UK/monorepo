import type { Database } from "@auction/db";
import { bidUserProfile, domainEvent, staffRoleAssignment } from "@auction/db/schema";
import {
  ADMINISTRATOR_STAFF_ROLE,
  type StaffRoles,
  activeStaffRoles,
  normalizeUserRoleOrClient,
} from "@auction/types";
import { and, asc, countDistinct, eq, inArray, isNotNull, isNull, lte, ne, sql } from "drizzle-orm";
import { writeBidUserProfile } from "../bid-user-profile-sync.js";
import type {
  IStaffRoleAssignmentReader,
  IStaffRoster,
  IStaffRosterFactsReader,
  IStaffRosterTransaction,
  NewStaffRoleAssignment,
  StaffProfileRoles,
  StaffRoleAssignmentRecord,
  StaffRosterEvent,
} from "../interfaces/staff-role-assignment.repository.js";
import {
  staffRoleAssignmentInForceAt,
  staffRoleAssignmentNotEndedAt,
} from "../lib/staff-role-assignment-sql.js";
import {
  type LaxStaffAccessEvent,
  insertLaxStaffAccessEvents,
} from "./drizzle-lax-staff-access.repository.js";

/** Shared with every roster change so concurrent changes run one after another. */
const STAFF_ROSTER_LOCK_KEY = "bid_staff_admin_roster";

type AssignmentRow = typeof staffRoleAssignment.$inferSelect;

/** A stored assignment row as the roster ports return it. */
export function toStaffRoleAssignmentRecord(row: AssignmentRow): StaffRoleAssignmentRecord {
  return {
    id: row.id,
    userId: row.userId,
    role: row.role,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    grantedByUserId: row.grantedByUserId,
    grantedAt: row.grantedAt,
    reason: row.reason,
  };
}

type StaffRoleEvent = Extract<
  StaffRosterEvent,
  { type: "staff.role_assigned" | "staff.role_removed" | "staff.role_expired" }
>;

function isStaffRoleEvent(event: StaffRosterEvent): event is StaffRoleEvent {
  return (
    event.type === "staff.role_assigned" ||
    event.type === "staff.role_removed" ||
    event.type === "staff.role_expired"
  );
}

async function selectCurrent(
  db: Database,
  userId: string,
  now: Date,
): Promise<StaffRoleAssignmentRecord[]> {
  const rows = await db
    .select()
    .from(staffRoleAssignment)
    .where(and(eq(staffRoleAssignment.userId, userId), staffRoleAssignmentNotEndedAt(now)))
    .orderBy(staffRoleAssignment.startsAt);
  return rows.map(toStaffRoleAssignmentRecord);
}

/** People other than `userId` who are active, unsuspended staff holding the administrator role. */
async function countOtherActiveAdministrators(
  db: Database,
  userId: string,
  now: Date,
): Promise<number> {
  const [row] = await db
    .select({ n: countDistinct(staffRoleAssignment.userId) })
    .from(staffRoleAssignment)
    .innerJoin(bidUserProfile, eq(bidUserProfile.userId, staffRoleAssignment.userId))
    .where(
      and(
        eq(staffRoleAssignment.role, ADMINISTRATOR_STAFF_ROLE),
        ne(staffRoleAssignment.userId, userId),
        staffRoleAssignmentInForceAt(now),
        eq(bidUserProfile.role, "staff"),
        isNull(bidUserProfile.suspendedAt),
      ),
    );
  return Number(row?.n ?? 0);
}

/** Reads assignments for sessions; works on a pool or inside a caller's transaction. */
export class DrizzleStaffRoleAssignmentReader
  implements IStaffRoleAssignmentReader, IStaffRosterFactsReader
{
  constructor(private readonly db: Database) {}

  listCurrent(userId: string, now: Date): Promise<StaffRoleAssignmentRecord[]> {
    return selectCurrent(this.db, userId, now);
  }

  async listActiveRoles(userId: string, now: Date): Promise<StaffRoles> {
    return activeStaffRoles(await selectCurrent(this.db, userId, now), now);
  }

  countOtherActiveAdministrators(userId: string, now: Date): Promise<number> {
    return countOtherActiveAdministrators(this.db, userId, now);
  }
}

class DrizzleStaffRosterTransaction implements IStaffRosterTransaction {
  constructor(
    private readonly tx: Database,
    private readonly producer: string,
  ) {}

  listCurrent(userId: string, now: Date): Promise<StaffRoleAssignmentRecord[]> {
    return selectCurrent(this.tx, userId, now);
  }

  countOtherActiveAdministrators(userId: string, now: Date): Promise<number> {
    return countOtherActiveAdministrators(this.tx, userId, now);
  }

  async insert(assignment: NewStaffRoleAssignment): Promise<StaffRoleAssignmentRecord> {
    const [row] = await this.tx
      .insert(staffRoleAssignment)
      .values({
        userId: assignment.userId,
        role: assignment.role,
        startsAt: assignment.startsAt,
        endsAt: assignment.endsAt,
        grantedByUserId: assignment.grantedByUserId,
        reason: assignment.reason,
      })
      .returning();
    if (!row) throw new Error("staff_role_assignment_insert_failed");
    return toStaffRoleAssignmentRecord(row);
  }

  async end(assignmentId: string, endsAt: Date): Promise<void> {
    await this.tx
      .update(staffRoleAssignment)
      .set({ endsAt, endRecordedAt: endsAt })
      .where(eq(staffRoleAssignment.id, assignmentId));
  }

  async listUnrecordedEnds(now: Date, limit: number): Promise<StaffRoleAssignmentRecord[]> {
    const rows = await this.tx
      .select()
      .from(staffRoleAssignment)
      .where(
        and(
          isNotNull(staffRoleAssignment.endsAt),
          lte(staffRoleAssignment.endsAt, now),
          isNull(staffRoleAssignment.endRecordedAt),
        ),
      )
      .orderBy(asc(staffRoleAssignment.endsAt), asc(staffRoleAssignment.id))
      .limit(limit)
      .for("update", { skipLocked: true });
    return rows.map(toStaffRoleAssignmentRecord);
  }

  async recordEnds(assignmentIds: readonly string[], at: Date): Promise<void> {
    if (assignmentIds.length === 0) return;
    await this.tx
      .update(staffRoleAssignment)
      .set({ endRecordedAt: at })
      .where(
        and(
          inArray(staffRoleAssignment.id, [...assignmentIds]),
          isNull(staffRoleAssignment.endRecordedAt),
        ),
      );
  }

  async writeProfileRoles(
    userId: string,
    next: StaffProfileRoles,
  ): Promise<StaffProfileRoles | null> {
    const [previous] = await this.tx
      .select({ role: bidUserProfile.role, staffRole: bidUserProfile.staffRole })
      .from(bidUserProfile)
      .where(eq(bidUserProfile.userId, userId))
      .for("update");
    await writeBidUserProfile(this.tx, userId, {
      role: next.role,
      staffRole: next.primaryStaffRole,
    });
    return previous
      ? { role: normalizeUserRoleOrClient(previous.role), primaryStaffRole: previous.staffRole }
      : null;
  }

  async recordEvents(events: readonly StaffRosterEvent[]): Promise<void> {
    const staffEvents = events.filter(isStaffRoleEvent);
    if (staffEvents.length > 0) {
      await this.tx.insert(domainEvent).values(
        staffEvents.map((event) => ({
          aggregateType: "user",
          aggregateId: event.userId,
          eventType: event.type,
          producer: this.producer,
          payload: event.payload,
          actorUserId: "actorUserId" in event ? event.actorUserId : null,
          schemaVersion: 1,
        })),
      );
    }
    await insertLaxStaffAccessEvents(
      this.tx,
      this.producer,
      events.filter((e): e is LaxStaffAccessEvent => !isStaffRoleEvent(e)),
    );
  }
}

/**
 * The Bid staff roster in Postgres. Each change runs in one transaction holding the roster
 * advisory lock; given a transaction instead of a pool, the change joins it.
 */
export class DrizzleStaffRoster extends DrizzleStaffRoleAssignmentReader implements IStaffRoster {
  constructor(
    private readonly database: Database,
    private readonly producer = "apps/api",
  ) {
    super(database);
  }

  transact<T>(work: (tx: IStaffRosterTransaction) => Promise<T>): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${STAFF_ROSTER_LOCK_KEY}))`);
      return work(new DrizzleStaffRosterTransaction(tx, this.producer));
    });
  }
}
