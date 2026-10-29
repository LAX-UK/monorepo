import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Cross-product staff access read model (D36). Rows are written only by triggers on each
 * product's role table; `api_app` may read it, nothing writes it directly.
 */
export const laxStaffAccessDirectory = pgTable(
  "lax_staff_access_directory",
  {
    subjectId: text("subject_id").notNull(),
    product: text("product").$type<"bid" | "shop">().notNull(),
    role: text("role").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: "lax_staff_access_directory_pk",
      columns: [table.subjectId, table.product],
    }),
    check("lax_staff_access_directory_product", sql`${table.product} IN ('bid', 'shop')`),
  ],
);

/**
 * Cross-product read model of each LAX Admin role assignment (D36), maintained by a trigger on
 * `shop_staff_role_assignment`. Bid admin reads it to show and check a person's LAX Admin roles;
 * `api_app` may read it, nothing writes it directly.
 */
export const laxStaffRoleDirectory = pgTable(
  "lax_staff_role_directory",
  {
    assignmentId: uuid("assignment_id").primaryKey(),
    subjectId: text("subject_id").notNull(),
    product: text("product").$type<"shop">().notNull(),
    role: text("role").notNull(),
    startsAt: timestamp("starts_at", { mode: "date", withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { mode: "date", withTimezone: true }),
    grantedBySubjectId: text("granted_by_subject_id"),
    grantedAt: timestamp("granted_at", { mode: "date", withTimezone: true }).notNull(),
    reason: text("reason"),
    endRecordedAt: timestamp("end_recorded_at", { mode: "date", withTimezone: true }),
    grantedEventId: bigint("granted_event_id", { mode: "number" }),
    endedEventId: bigint("ended_event_id", { mode: "number" }),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("lax_staff_role_directory_subject_idx").on(table.subjectId),
    check("lax_staff_role_directory_product", sql`${table.product} IN ('shop')`),
  ],
);
