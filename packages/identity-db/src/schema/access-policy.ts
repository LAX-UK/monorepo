import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";

/**
 * Identity-side projection that a subject holds staff or org access somewhere in LAX.
 * Records only *that* access exists (never which role) so Identity can apply security
 * policy without owning product authorization (D13). Maintained by database triggers on
 * the product role tables; application roles never write it directly.
 */
export const identityAccessMarker = pgTable(
  "identity_access_marker",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectId: text("subject_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    /** Product granting staff access (`bid` | `shop`); null for org membership markers. */
    product: text("product"),
    /** Organisation for `org_member` markers; null for staff markers. */
    legalEntityId: uuid("legal_entity_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("identity_access_marker_staff_uidx")
      .on(table.subjectId, table.product)
      .where(sql`${table.kind} = 'staff'`),
    uniqueIndex("identity_access_marker_org_uidx")
      .on(table.subjectId, table.legalEntityId)
      .where(sql`${table.kind} = 'org_member'`),
    index("identity_access_marker_subject_idx").on(table.subjectId),
    index("identity_access_marker_org_idx").on(table.legalEntityId),
    check(
      "identity_access_marker_shape",
      sql`(${table.kind} = 'staff' AND ${table.product} IN ('bid', 'shop') AND ${table.legalEntityId} IS NULL)
        OR (${table.kind} = 'org_member' AND ${table.product} IS NULL AND ${table.legalEntityId} IS NOT NULL)`,
    ),
  ],
);

/** Two-step verification requirement set by a LAX super admin (staff) or an org owner. */
export const identityMfaPolicy = pgTable(
  "identity_mfa_policy",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scope: text("scope").notNull(),
    legalEntityId: uuid("legal_entity_id"),
    required: boolean("required").notNull(),
    setBySubjectId: text("set_by_subject_id"),
    setAt: timestamp("set_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("identity_mfa_policy_staff_uidx")
      .on(table.scope)
      .where(sql`${table.scope} = 'staff'`),
    uniqueIndex("identity_mfa_policy_org_uidx")
      .on(table.legalEntityId)
      .where(sql`${table.scope} = 'org'`),
    check(
      "identity_mfa_policy_shape",
      sql`(${table.scope} = 'staff' AND ${table.legalEntityId} IS NULL)
        OR (${table.scope} = 'org' AND ${table.legalEntityId} IS NOT NULL)`,
    ),
  ],
);
