import type { Database } from "@auction/db";
import { domainEvent, laxStaffRoleDirectory } from "@auction/db/schema";
import {
  LAX_ADMIN_ADMINISTRATOR_ROLE,
  type LaxShopStaffRole,
  isLaxAdminRole,
  laxStaffAccessGrantedPayloadSchemaV1,
  laxStaffAccessRevokedPayloadSchemaV1,
} from "@auction/types";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type {
  ILaxAdminRoleExpiryRequests,
  ILaxAdminRoleReader,
  ILaxAdminRoleRequestWriter,
  LaxAdminRoleAssignmentRecord,
  LaxAdminRoleEnd,
  LaxAdminRoleRequest,
  NewLaxAdminRoleGrant,
  NewLaxAdminRoleRemoval,
} from "../interfaces/lax-admin-roles.repository.js";
import { insertLaxStaffAccessEvents } from "./drizzle-lax-staff-access.repository.js";

const GRANTED = "lax.staff_access.granted";
const REVOKED = "lax.staff_access.revoked";
const EXPIRY_LOCK_KEY = "lax_admin_role_expiry";
const REQUEST_LIMIT = 50;

type Row = typeof laxStaffRoleDirectory.$inferSelect;

function toRecord(row: Row & { role: LaxShopStaffRole }): LaxAdminRoleAssignmentRecord {
  return {
    id: row.assignmentId,
    subjectId: row.subjectId,
    role: row.role,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    grantedBySubjectId: row.grantedBySubjectId,
    grantedAt: row.grantedAt,
    reason: row.reason,
    endRecordedAt: row.endRecordedAt,
    grantedEventId: row.grantedEventId,
    endedEventId: row.endedEventId,
  };
}

/** Rows whose role this release knows; a role LAX Admin added later is not shown here. */
function known(rows: Row[]): LaxAdminRoleAssignmentRecord[] {
  return rows.flatMap((row) =>
    isLaxAdminRole(row.role) ? [toRecord({ ...row, role: row.role })] : [],
  );
}

const notEndedAt = (now: Date) =>
  or(isNull(laxStaffRoleDirectory.endsAt), gt(laxStaffRoleDirectory.endsAt, now));

const inForceAt = (now: Date) => and(lte(laxStaffRoleDirectory.startsAt, now), notEndedAt(now));

/**
 * LAX Admin roles from Bid's side: read from the directory LAX Admin keeps, and asked for with
 * `lax.staff_access.*` events in the caller's transaction.
 */
export class DrizzleLaxAdminRolesRepository
  implements ILaxAdminRoleReader, ILaxAdminRoleRequestWriter, ILaxAdminRoleExpiryRequests
{
  constructor(
    private readonly db: Database,
    private readonly producer = "apps/api",
  ) {}

  async listCurrent(subjectId: string, now: Date): Promise<LaxAdminRoleAssignmentRecord[]> {
    const rows = await this.db
      .select()
      .from(laxStaffRoleDirectory)
      .where(and(eq(laxStaffRoleDirectory.subjectId, subjectId), notEndedAt(now)))
      .orderBy(asc(laxStaffRoleDirectory.startsAt));
    return known(rows);
  }

  async listAllCurrent(now: Date): Promise<LaxAdminRoleAssignmentRecord[]> {
    const rows = await this.db
      .select()
      .from(laxStaffRoleDirectory)
      .where(notEndedAt(now))
      .orderBy(asc(laxStaffRoleDirectory.subjectId), asc(laxStaffRoleDirectory.startsAt));
    return known(rows);
  }

  async countOtherActiveAdministrators(subjectId: string, now: Date): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(distinct ${laxStaffRoleDirectory.subjectId})::int` })
      .from(laxStaffRoleDirectory)
      .where(
        and(
          eq(laxStaffRoleDirectory.role, LAX_ADMIN_ADMINISTRATOR_ROLE),
          ne(laxStaffRoleDirectory.subjectId, subjectId),
          inForceAt(now),
        ),
      );
    return row?.count ?? 0;
  }

  async listActiveAdministratorIds(now: Date): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ subjectId: laxStaffRoleDirectory.subjectId })
      .from(laxStaffRoleDirectory)
      .where(and(eq(laxStaffRoleDirectory.role, LAX_ADMIN_ADMINISTRATOR_ROLE), inForceAt(now)));
    return rows.map((r) => r.subjectId);
  }

  async listRequestsSince(subjectId: string, since: Date): Promise<LaxAdminRoleRequest[]> {
    const rows = await this.db
      .select({
        id: domainEvent.id,
        eventType: domainEvent.eventType,
        payload: domainEvent.payload,
        occurredAt: domainEvent.occurredAt,
      })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.aggregateType, "user"),
          eq(domainEvent.aggregateId, subjectId),
          inArray(domainEvent.eventType, [GRANTED, REVOKED]),
          sql`${domainEvent.payload}->>'product' = 'shop'`,
          gte(domainEvent.occurredAt, since),
        ),
      )
      .orderBy(desc(domainEvent.occurredAt), desc(domainEvent.id))
      .limit(REQUEST_LIMIT);
    return rows.flatMap((row): LaxAdminRoleRequest[] => {
      if (row.eventType === GRANTED) {
        const parsed = laxStaffAccessGrantedPayloadSchemaV1.safeParse(row.payload);
        if (!parsed.success || !isLaxAdminRole(parsed.data.role)) return [];
        return [
          {
            eventId: row.id,
            at: row.occurredAt,
            subjectId,
            kind: "assign",
            role: parsed.data.role,
            endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
          },
        ];
      }
      const parsed = laxStaffAccessRevokedPayloadSchemaV1.safeParse(row.payload);
      // Expiries and the removal of every role are not role requests a screen waits on.
      if (!parsed.success || parsed.data.assignmentId || !isLaxAdminRole(parsed.data.role)) {
        return [];
      }
      return [
        {
          eventId: row.id,
          at: row.occurredAt,
          subjectId,
          kind: "remove",
          role: parsed.data.role,
          endsAt: null,
        },
      ];
    });
  }

  async requestGrant(grant: NewLaxAdminRoleGrant): Promise<void> {
    await insertLaxStaffAccessEvents(this.db, this.producer, [
      {
        type: GRANTED,
        payload: {
          schemaVersion: 1,
          subjectId: grant.subjectId,
          product: "shop",
          role: grant.role,
          grantedBySubjectId: grant.actorSubjectId,
          invitationId: null,
          endsAt: grant.endsAt?.toISOString() ?? null,
          reason: grant.reason,
        },
      },
    ]);
  }

  async requestRemoval(removal: NewLaxAdminRoleRemoval): Promise<void> {
    await insertLaxStaffAccessEvents(this.db, this.producer, [
      {
        type: REVOKED,
        payload: {
          schemaVersion: 1,
          subjectId: removal.subjectId,
          product: "shop",
          role: removal.role,
          revokedBySubjectId: removal.actorSubjectId,
          reason: removal.reason,
        },
      },
    ]);
  }

  async requestDueEnds(now: Date, limit: number): Promise<LaxAdminRoleEnd[]> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${EXPIRY_LOCK_KEY}))`);
      const asked = sql`exists (
        select 1 from ${domainEvent} e
        where e.aggregate_type = 'user'
          and e.aggregate_id = ${laxStaffRoleDirectory.subjectId}
          and e.event_type = ${REVOKED}
          and e.payload->>'assignmentId' = ${laxStaffRoleDirectory.assignmentId}::text
      )`;
      const rows = await tx
        .select()
        .from(laxStaffRoleDirectory)
        .where(
          and(
            isNotNull(laxStaffRoleDirectory.endsAt),
            lte(laxStaffRoleDirectory.endsAt, now),
            isNull(laxStaffRoleDirectory.endRecordedAt),
            sql`not ${asked}`,
          ),
        )
        .orderBy(asc(laxStaffRoleDirectory.endsAt))
        .limit(limit);
      const ends = known(rows).map((a) => ({
        assignmentId: a.id,
        subjectId: a.subjectId,
        role: a.role,
        endedAt: a.endsAt ?? now,
      }));
      await insertLaxStaffAccessEvents(
        tx as unknown as Database,
        this.producer,
        ends.map((end) => ({
          type: REVOKED,
          actorUserId: null,
          payload: {
            schemaVersion: 1,
            subjectId: end.subjectId,
            product: "shop",
            role: end.role,
            assignmentId: end.assignmentId,
            // The end date did it: the person is the actor, as for Bid's own expiries.
            revokedBySubjectId: end.subjectId,
          },
        })),
      );
      return ends;
    });
  }
}
