import type { Database } from "@auction/db";
import {
  shopAdminAudit,
  shopClientAssignment,
  shopEdition,
  shopOrder,
  shopParty,
  shopStaffMember,
  shopUserProfile,
} from "@auction/db/schema";
import {
  ADMIN_CLIENT_KINDS,
  type AdminAuditEntry,
  type AdminAuditFacets,
  type AdminAuditListQuery,
  type AdminStaffListQuery,
} from "@auction/shop-contracts";
import {
  type SQL,
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  max,
  or,
  sql,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { decodeCatalogueCursor } from "../application/catalogue-cursor.js";
import type {
  AdminPartyListItem,
  AdminStaffMemberListItem,
  ClientPartyListInput,
  CursorListResult,
  WorkListResult,
} from "../application/ports/admin-readers.js";
import { keysetAfter, orderByMsTimestampId } from "./admin-created-at-keyset.js";
import { parseAuditDetail } from "./drizzle-admin-detail.repository.js";
import {
  countsOf,
  pageOf,
  parseSort,
  resolveWorkListLimit,
  searchPatterns,
} from "./drizzle-admin-work-lists.reader.js";

/*
 * The people lists in LAX Admin: clients, staff and the audit log. Each searches, filters, sorts
 * by one timestamp with the id as the tiebreaker in either direction, and pages by keyset. The
 * clients and staff lists also count their rows per view under every other filter, so the view
 * tabs add up to the list.
 */

/** How many event codes, record kinds and people the audit filters offer at most. */
const AUDIT_FACET_LIMIT = 200;

const clean = (value: string | null | undefined) => value?.trim() || null;

function ilike(column: AnyPgColumn | SQL, pattern: string): SQL {
  return sql`${column} ILIKE ${pattern}`;
}

/** From the start of a calendar day in UK time (inclusive). */
function fromLondonDay(column: AnyPgColumn, day: string): SQL {
  return sql`${column} >= (${day}::date)::timestamp AT TIME ZONE 'Europe/London'`;
}

/** Up to the end of a calendar day in UK time (inclusive). */
function toLondonDay(column: AnyPgColumn, day: string): SQL {
  return sql`${column} < ((${day}::date + 1))::timestamp AT TIME ZONE 'Europe/London'`;
}

export function createDrizzleAdminPeopleListsReader(db: Database) {
  return {
    async listClientParties(
      input: ClientPartyListInput,
    ): Promise<WorkListResult<AdminPartyListItem>> {
      const limit = resolveWorkListLimit(input.limit);
      const cursor = decodeCatalogueCursor(input.cursor);
      const { direction } = parseSort<"joined">(input.sort, "joined_desc");
      const search = searchPatterns(input.q);
      const brokerSubjectId = input.brokerSubjectId?.trim();
      // Who the list may show at all, then what the search narrows it to; the kind is a view.
      const filters = [
        inArray(shopParty.kind, [...ADMIN_CLIENT_KINDS]),
        brokerSubjectId
          ? inArray(
              shopParty.id,
              db
                .select({ id: shopClientAssignment.clientPartyId })
                .from(shopClientAssignment)
                .where(eq(shopClientAssignment.brokerSubjectId, brokerSubjectId)),
            )
          : undefined,
        search
          ? or(
              ilike(shopParty.displayName, search.contains),
              ilike(shopUserProfile.email, search.contains),
            )
          : undefined,
      ];
      const [rows, countRows] = await Promise.all([
        db
          .select({
            party: shopParty,
            email: shopUserProfile.email,
            editionCount: sql<number>`(
              select count(*)::int from ${shopEdition} where ${shopEdition.ownerPartyId} = ${shopParty.id}
            )`,
            paidOrderCount: sql<number>`(
              select count(*)::int from ${shopOrder}
              where ${shopOrder.paidAt} is not null
                and (${shopOrder.buyerPartyId} = ${shopParty.id}
                  or ${shopOrder.identitySubjectId} = ${shopParty.identitySubjectId})
            )`,
          })
          .from(shopParty)
          .leftJoin(
            shopUserProfile,
            eq(shopUserProfile.identitySubjectId, shopParty.identitySubjectId),
          )
          .where(
            and(
              ...filters,
              input.kind ? eq(shopParty.kind, input.kind) : undefined,
              cursor
                ? keysetAfter(shopParty.createdAt, shopParty.id, cursor, direction)
                : undefined,
            ),
          )
          .orderBy(...orderByMsTimestampId(shopParty.createdAt, shopParty.id, direction))
          .limit(limit + 1),
        db
          .select({ status: shopParty.kind, total: count() })
          .from(shopParty)
          .leftJoin(
            shopUserProfile,
            eq(shopUserProfile.identitySubjectId, shopParty.identitySubjectId),
          )
          .where(and(...filters))
          .groupBy(shopParty.kind),
      ]);
      return {
        ...pageOf(
          rows,
          limit,
          ({ party }) => ({ createdAt: party.createdAt, id: party.id }),
          ({ party, email, editionCount, paidOrderCount }) => ({
            partyId: party.id,
            displayName: party.displayName,
            kind: party.kind,
            identitySubjectId: party.identitySubjectId,
            createdAt: party.createdAt.toISOString(),
            email: clean(email),
            editionCount: Number(editionCount),
            paidOrderCount: Number(paidOrderCount),
          }),
        ),
        counts: countsOf(countRows),
      };
    },

    async listStaffMembers(
      input: AdminStaffListQuery,
    ): Promise<WorkListResult<AdminStaffMemberListItem>> {
      const limit = resolveWorkListLimit(input.limit);
      const cursor = decodeCatalogueCursor(input.cursor);
      const { direction } = parseSort<"added">(input.sort, "added_desc");
      const search = searchPatterns(input.q);
      // "Last active" is their latest admin action, the only activity recorded for staff.
      const lastActive = db
        .select({
          actorSubjectId: shopAdminAudit.actorSubjectId,
          lastActiveAt: max(shopAdminAudit.createdAt).as("last_active_at"),
        })
        .from(shopAdminAudit)
        .groupBy(shopAdminAudit.actorSubjectId)
        .as("staff_last_active");
      const filters = [
        input.role
          ? inArray(
              shopStaffMember.role,
              input.role.split(",") as (typeof shopStaffMember.$inferSelect.role)[],
            )
          : undefined,
        search
          ? or(
              ilike(shopUserProfile.name, search.contains),
              ilike(shopUserProfile.email, search.contains),
            )
          : undefined,
      ];
      const statusOf = sql<string>`case when ${shopStaffMember.disabledAt} is null then 'active' else 'disabled' end`;
      const [rows, countRows] = await Promise.all([
        db
          .select({
            member: shopStaffMember,
            displayName: shopUserProfile.name,
            email: shopUserProfile.email,
            lastActiveAt: lastActive.lastActiveAt,
          })
          .from(shopStaffMember)
          .leftJoin(
            shopUserProfile,
            eq(shopUserProfile.identitySubjectId, shopStaffMember.identitySubjectId),
          )
          .leftJoin(lastActive, eq(lastActive.actorSubjectId, shopStaffMember.identitySubjectId))
          .where(
            and(
              ...filters,
              input.status === "active" ? isNull(shopStaffMember.disabledAt) : undefined,
              input.status === "disabled" ? isNotNull(shopStaffMember.disabledAt) : undefined,
              cursor
                ? keysetAfter(shopStaffMember.createdAt, shopStaffMember.id, cursor, direction)
                : undefined,
            ),
          )
          .orderBy(
            ...orderByMsTimestampId(shopStaffMember.createdAt, shopStaffMember.id, direction),
          )
          .limit(limit + 1),
        db
          .select({ status: statusOf, total: count() })
          .from(shopStaffMember)
          .leftJoin(
            shopUserProfile,
            eq(shopUserProfile.identitySubjectId, shopStaffMember.identitySubjectId),
          )
          .where(and(...filters))
          .groupBy(statusOf),
      ]);
      return {
        ...pageOf(
          rows,
          limit,
          ({ member }) => ({ createdAt: member.createdAt, id: member.id }),
          (row) => ({
            staffMemberId: row.member.id,
            identitySubjectId: row.member.identitySubjectId,
            displayName: clean(row.displayName),
            email: clean(row.email),
            lastActiveAt: row.lastActiveAt ? new Date(row.lastActiveAt).toISOString() : null,
            role: row.member.role,
            disabledAt: row.member.disabledAt?.toISOString() ?? null,
            createdAt: row.member.createdAt.toISOString(),
          }),
        ),
        counts: countsOf(countRows),
      };
    },

    async listAuditEntries(input: AdminAuditListQuery): Promise<CursorListResult<AdminAuditEntry>> {
      const limit = resolveWorkListLimit(input.limit);
      const cursor = decodeCatalogueCursor(input.cursor);
      const { direction } = parseSort<"at">(input.sort, "at_desc");
      const search = searchPatterns(input.q);
      const rows = await db
        .select({
          audit: shopAdminAudit,
          actorName: shopUserProfile.name,
          actorEmail: shopUserProfile.email,
        })
        .from(shopAdminAudit)
        .leftJoin(
          shopUserProfile,
          eq(shopUserProfile.identitySubjectId, shopAdminAudit.actorSubjectId),
        )
        .where(
          and(
            input.actor ? eq(shopAdminAudit.actorSubjectId, input.actor) : undefined,
            input.action ? eq(shopAdminAudit.action, input.action) : undefined,
            input.targetType ? eq(shopAdminAudit.targetType, input.targetType) : undefined,
            input.targetId ? eq(shopAdminAudit.targetId, input.targetId) : undefined,
            input.from ? fromLondonDay(shopAdminAudit.createdAt, input.from) : undefined,
            input.to ? toLondonDay(shopAdminAudit.createdAt, input.to) : undefined,
            search
              ? or(
                  ilike(shopAdminAudit.action, search.contains),
                  ilike(shopAdminAudit.targetId, search.prefix),
                  ilike(shopUserProfile.name, search.contains),
                  ilike(shopUserProfile.email, search.contains),
                )
              : undefined,
            cursor
              ? keysetAfter(shopAdminAudit.createdAt, shopAdminAudit.id, cursor, direction)
              : undefined,
          ),
        )
        .orderBy(...orderByMsTimestampId(shopAdminAudit.createdAt, shopAdminAudit.id, direction))
        .limit(limit + 1);
      return pageOf(
        rows,
        limit,
        ({ audit }) => ({ createdAt: audit.createdAt, id: audit.id }),
        ({ audit, actorName, actorEmail }) => ({
          auditId: audit.id,
          actorSubjectId: audit.actorSubjectId,
          capability: audit.capability,
          action: audit.action,
          targetType: audit.targetType,
          targetId: audit.targetId,
          createdAt: audit.createdAt.toISOString(),
          actorName: clean(actorName),
          actorEmail: clean(actorEmail),
          before: parseAuditDetail(audit.beforeJson),
          after: parseAuditDetail(audit.afterJson),
        }),
      );
    },

    async readAuditFacets(): Promise<AdminAuditFacets> {
      const [actions, targetTypes, actors] = await Promise.all([
        db
          .selectDistinct({ value: shopAdminAudit.action })
          .from(shopAdminAudit)
          .orderBy(asc(shopAdminAudit.action))
          .limit(AUDIT_FACET_LIMIT),
        db
          .selectDistinct({ value: shopAdminAudit.targetType })
          .from(shopAdminAudit)
          .orderBy(asc(shopAdminAudit.targetType))
          .limit(AUDIT_FACET_LIMIT),
        // The people who acted most recently first, so a long history keeps current staff.
        db
          .select({
            subjectId: shopAdminAudit.actorSubjectId,
            name: shopUserProfile.name,
            email: shopUserProfile.email,
          })
          .from(shopAdminAudit)
          .leftJoin(
            shopUserProfile,
            eq(shopUserProfile.identitySubjectId, shopAdminAudit.actorSubjectId),
          )
          .groupBy(shopAdminAudit.actorSubjectId, shopUserProfile.name, shopUserProfile.email)
          .orderBy(desc(max(shopAdminAudit.createdAt)), asc(shopAdminAudit.actorSubjectId))
          .limit(AUDIT_FACET_LIMIT),
      ]);
      return {
        actions: actions.map((row) => row.value),
        targetTypes: targetTypes.map((row) => row.value),
        actors: actors.map((row) => ({
          subjectId: row.subjectId,
          name: clean(row.name),
          email: clean(row.email),
        })),
      };
    },
  };
}
