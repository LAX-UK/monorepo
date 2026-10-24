import { index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

/**
 * A table view a Bid admin staff member saved for a list: the URL search params that define it.
 * Owned by the person (Identity subject), never shared. No foreign key to `user`: the API role
 * does not read that table and the view is not worth coupling to it.
 */
export const adminSavedView = pgTable(
  "admin_saved_view",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerSubjectId: text("owner_subject_id").notNull(),
    listKey: text("list_key").notNull(),
    label: text("label").notNull(),
    query: text("query").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("admin_saved_view_owner_list_label_uid").on(
      table.ownerSubjectId,
      table.listKey,
      table.label,
    ),
    index("admin_saved_view_owner_list_idx").on(table.ownerSubjectId, table.listKey),
  ],
);
