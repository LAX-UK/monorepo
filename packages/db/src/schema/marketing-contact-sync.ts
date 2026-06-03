import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

/** Outcome of one attempt to sync a user into the external marketing ESP (Brevo). */
export type MarketingContactSyncStatus = "synced" | "archived" | "skipped" | "rejected" | "failed";

export const marketingContactSyncLog = pgTable(
  "marketing_contact_sync_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    /** upsert | archive | skipped — the operation that was attempted. */
    action: text("action").notNull(),
    status: text("status").$type<MarketingContactSyncStatus>().notNull(),
    /** Why the sync ran: registered | email_verified | kyc_verified | deletion_requested. */
    reason: text("reason"),
    providerContactId: text("provider_contact_id"),
    responseCode: integer("response_code"),
    error: text("error"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("marketing_contact_sync_log_user_id_idx").on(table.userId),
    index("marketing_contact_sync_log_status_created_at_idx").on(table.status, table.createdAt),
  ],
);

export const marketingContactSyncLogRelations = relations(marketingContactSyncLog, ({ one }) => ({
  user: one(user, {
    fields: [marketingContactSyncLog.userId],
    references: [user.id],
  }),
}));
