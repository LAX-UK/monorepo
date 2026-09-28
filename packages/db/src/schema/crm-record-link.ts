import { sql } from "drizzle-orm";
import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/** Maps platform entities to Zoho CRM record ids (worker-owned projection). */
export const crmRecordLink = pgTable(
  "crm_record_link",
  {
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    zohoModule: text("zoho_module").notNull(),
    zohoRecordId: text("zoho_record_id").notNull(),
    subjectId: text("subject_id"),
    erasedAt: timestamp("erased_at", { mode: "date", withTimezone: true }),
    deletionRequestedAt: timestamp("deletion_requested_at", {
      mode: "date",
      withTimezone: true,
    }),
    recyclePurgedAt: timestamp("recycle_purged_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.entityType, table.entityId], name: "crm_record_link_pkey" }),
    index("crm_record_link_zoho_module_record_idx").on(table.zohoModule, table.zohoRecordId),
    index("crm_record_link_erased_at_idx")
      .on(table.erasedAt)
      .where(sql`${table.erasedAt} IS NOT NULL`),
    index("crm_record_link_deal_subject_idx")
      .on(table.subjectId)
      .where(sql`${table.entityType} = 'deal' AND ${table.erasedAt} IS NULL`),
  ],
);
