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
import { laxShopStaffRoles } from "@auction/types";
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
import {
  decodeCatalogueCursor,
  decodeNameCursor,
  encodeCatalogueCursor,
  encodeNameCursor,
  truncateCatalogueCursorDate,
} from "../application/catalogue-cursor.js";
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
import {
  type CurrentShopStaffRole,
  currentShopStaffRolesSql,
  holdsAnyShopStaffRoleSql,
} from "./shop-staff-active-roles.sql.js";

const ROLE_ORDER = new Map<string, number>(laxShopStaffRoles.map((role, i) => [role, i]));

/** A person's roles in role order, so the same set always reads the same. */
function inRoleOrder(roles: readonly CurrentShopStaffRole[]): CurrentShopStaffRole[] {
  return [...roles].sort((a, b) => (ROLE_ORDER.get(a.role) ?? 99) - (ROLE_ORDER.get(b.role) ?? 99));
}

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

/**
 * How a people list is ordered and paged: by a name (A to Z or Z to A) with a name cursor, or by
 * a timestamp with the catalogue cursor. The id breaks ties either way, so paging never skips or
 * repeats a row.
 */
function peopleSort(input: {
  sort: string;
  cursor: string | undefined;
  name: AnyPgColumn | SQL;
  at: AnyPgColumn;
  id: AnyPgColumn;
}) {
  const { key, direction } = parseSort<string>(input.sort, input.sort as `${string}_asc`);
  const byName = key === "name";
  if (byName) {
    const cursor = decodeNameCursor(input.cursor);
    const op = direction === "asc" ? sql`>` : sql`<`;
    return {
      byName,
      after: cursor
        ? sql`(${input.name}, ${input.id}) ${op} (${cursor.name}, ${cursor.id})`
        : undefined,
      orderBy:
        direction === "asc" ? [asc(input.name), asc(input.id)] : [desc(input.name), desc(input.id)],
      next: (row: { name: string; at: Date; id: string }) =>
        encodeNameCursor({ name: row.name, id: row.id }),
    };
  }
  const cursor = decodeCatalogueCursor(input.cursor);
  return {
    byName,
    after: cursor ? keysetAfter(input.at, input.id, cursor, direction) : undefined,
    orderBy: [...orderByMsTimestampId(input.at, input.id, direction)],
    next: (row: { name: string; at: Date; id: string }) =>
      encodeCatalogueCursor({ createdAt: truncateCatalogueCursorDate(row.at), id: row.id }),
  };
}

/** The page and its cursor under the list's sort. */
function pageBy<T, R>(
  rows: readonly T[],
  limit: number,
  keyOf: (row: T) => { name: string; at: Date; id: string },
  next: (key: { name: string; at: Date; id: string }) => string,
  mapRow: (row: T) => R,
): { items: R[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  return { items: page.map(mapRow), nextCursor: hasMore && last ? next(keyOf(last)) : null };
}

export function createDrizzleAdminPeopleListsReader(db: Database) {
  return {
    async listClientParties(
      input: ClientPartyListInput,
    ): Promise<WorkListResult<AdminPartyListItem>> {
      const limit = resolveWorkListLimit(input.limit);
      const order = peopleSort({
        sort: input.sort ?? "joined_desc",
        cursor: input.cursor,
        name: shopParty.displayName,
        at: shopParty.createdAt,
        id: shopParty.id,
      });
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
            and(...filters, input.kind ? eq(shopParty.kind, input.kind) : undefined, order.after),
          )
          .orderBy(...order.orderBy)
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
        ...pageBy(
          rows,
          limit,
          ({ party }) => ({ name: party.displayName, at: party.createdAt, id: party.id }),
          order.next,
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
      // Staff are named by their profile name, else their email, as in LAX Admin.
      const staffName = sql<string>`coalesce(nullif(trim(${shopUserProfile.name}), ''), ${shopUserProfile.email}, '')`;
      const order = peopleSort({
        sort: input.sort ?? "name_asc",
        cursor: input.cursor,
        name: staffName,
        at: shopStaffMember.createdAt,
        id: shopStaffMember.id,
      });
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
        // A person counts for every role they hold in force, not only the one shown.
        input.role
          ? holdsAnyShopStaffRoleSql(shopStaffMember.identitySubjectId, input.role.split(","))
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
            roles: currentShopStaffRolesSql(shopStaffMember.identitySubjectId),
            displayName: shopUserProfile.name,
            email: shopUserProfile.email,
            lastActiveAt: lastActive.lastActiveAt,
            sortName: staffName,
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
              order.after,
            ),
          )
          .orderBy(...order.orderBy)
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
        ...pageBy(
          rows,
          limit,
          ({ member, sortName }) => ({ name: sortName, at: member.createdAt, id: member.id }),
          order.next,
          (row) => ({
            staffMemberId: row.member.id,
            identitySubjectId: row.member.identitySubjectId,
            displayName: clean(row.displayName),
            email: clean(row.email),
            lastActiveAt: row.lastActiveAt ? new Date(row.lastActiveAt).toISOString() : null,
            role: row.member.role,
            roles: inRoleOrder(row.roles),
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
