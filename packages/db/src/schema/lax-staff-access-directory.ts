import { sql } from "drizzle-orm";
import { check, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

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
