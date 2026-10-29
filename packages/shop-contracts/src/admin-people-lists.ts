import { type Static, type TLiteral, Type } from "@sinclair/typebox";
import {
  ADMIN_WORK_LIST_MAX_LIMIT,
  ADMIN_WORK_LIST_SEARCH_MAX_LENGTH,
} from "./admin-work-lists.js";

/*
 * The people lists in LAX Admin: clients, staff and the audit log. Each takes a search, its own
 * filters, a sort and a keyset cursor, like the sales and operations lists. Every sort orders by
 * one timestamp with the record id as the tiebreaker, so paging never skips or repeats a row.
 */

function literals<const T extends readonly string[]>(values: T) {
  return Type.Union(values.map((value) => Type.Literal(value)) as TLiteral<T[number]>[]);
}

const CursorSchema = Type.Optional(Type.String({ maxLength: 512 }));
const LimitSchema = Type.Optional(Type.Integer({ minimum: 1, maximum: ADMIN_WORK_LIST_MAX_LIMIT }));
const SearchSchema = Type.Optional(Type.String({ maxLength: ADMIN_WORK_LIST_SEARCH_MAX_LENGTH }));
const CalendarDateSchema = Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" });

// Clients ----------------------------------------------------------------------------------

/** The kinds of party the Clients list holds; the views count rows per kind. */
export const ADMIN_CLIENT_KINDS = ["person", "gallery"] as const;
export type AdminClientKind = (typeof ADMIN_CLIENT_KINDS)[number];

/** The first is the default. */
export const ADMIN_CLIENT_SORTS = ["joined_desc", "joined_asc", "name_asc", "name_desc"] as const;
export type AdminClientSort = (typeof ADMIN_CLIENT_SORTS)[number];

/** `q` matches the client's name and the email on their LAX profile. */
export const AdminClientListQuerySchema = Type.Object({
  kind: Type.Optional(literals(ADMIN_CLIENT_KINDS)),
  q: SearchSchema,
  sort: Type.Optional(literals(ADMIN_CLIENT_SORTS)),
  cursor: CursorSchema,
  limit: LimitSchema,
});
export type AdminClientListQuery = Static<typeof AdminClientListQuerySchema>;

// Staff ------------------------------------------------------------------------------------

/** Active staff can sign in to LAX Admin; access removed keeps the record for the audit log. */
export const ADMIN_STAFF_STATUSES = ["active", "disabled"] as const;
export type AdminStaffStatus = (typeof ADMIN_STAFF_STATUSES)[number];

export const ADMIN_STAFF_ROLES = [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
  "editor",
  "read_only",
] as const;

/** The first is the default. */
export const ADMIN_STAFF_SORTS = ["name_asc", "name_desc", "added_desc", "added_asc"] as const;
export type AdminStaffSort = (typeof ADMIN_STAFF_SORTS)[number];

const STAFF_ROLE_PATTERN = `(${ADMIN_STAFF_ROLES.join("|")})`;

/**
 * `role` is one role or several, comma-separated ("account_manager,broker"), for a team. `q`
 * matches the person's name and email.
 */
export const AdminStaffListQuerySchema = Type.Object({
  status: Type.Optional(literals(ADMIN_STAFF_STATUSES)),
  role: Type.Optional(
    Type.String({ pattern: `^${STAFF_ROLE_PATTERN}(,${STAFF_ROLE_PATTERN})*$`, maxLength: 200 }),
  ),
  q: SearchSchema,
  sort: Type.Optional(literals(ADMIN_STAFF_SORTS)),
  cursor: CursorSchema,
  limit: LimitSchema,
});
export type AdminStaffListQuery = Static<typeof AdminStaffListQuerySchema>;

// Audit log --------------------------------------------------------------------------------

/** The first is the default: newest first. */
export const ADMIN_AUDIT_SORTS = ["at_desc", "at_asc"] as const;
export type AdminAuditSort = (typeof ADMIN_AUDIT_SORTS)[number];

export const ADMIN_AUDIT_FILTER_MAX_LENGTH = 200;

/**
 * `actor` is the person's identity subject, `action` the event code, `targetType` the kind of
 * record and `targetId` one record. `from` and `to` are inclusive calendar days in UK time. `q`
 * matches the event code and the start of the record id.
 */
export const AdminAuditListQuerySchema = Type.Object({
  actor: Type.Optional(Type.String({ minLength: 1, maxLength: ADMIN_AUDIT_FILTER_MAX_LENGTH })),
  action: Type.Optional(Type.String({ minLength: 1, maxLength: ADMIN_AUDIT_FILTER_MAX_LENGTH })),
  targetType: Type.Optional(
    Type.String({ minLength: 1, maxLength: ADMIN_AUDIT_FILTER_MAX_LENGTH }),
  ),
  targetId: Type.Optional(Type.String({ minLength: 1, maxLength: ADMIN_AUDIT_FILTER_MAX_LENGTH })),
  from: Type.Optional(CalendarDateSchema),
  to: Type.Optional(CalendarDateSchema),
  q: SearchSchema,
  sort: Type.Optional(literals(ADMIN_AUDIT_SORTS)),
  cursor: CursorSchema,
  limit: LimitSchema,
});
export type AdminAuditListQuery = Static<typeof AdminAuditListQuerySchema>;

/** What the audit filters offer: the event codes, record kinds and people the log holds. */
export const AdminAuditFacetsSchema = Type.Object({
  actions: Type.Array(Type.String()),
  targetTypes: Type.Array(Type.String()),
  actors: Type.Array(
    Type.Object({
      subjectId: Type.String(),
      name: Type.Union([Type.String(), Type.Null()]),
      email: Type.Union([Type.String(), Type.Null()]),
    }),
  ),
});
export type AdminAuditFacets = Static<typeof AdminAuditFacetsSchema>;
