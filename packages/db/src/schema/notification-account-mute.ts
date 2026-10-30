import { index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";

/**
 * A member's "Don't notify me about this organisation". Notifications about a muted account
 * are not delivered to that person on any channel. Removing the row unmutes.
 */
export const notificationAccountMute = pgTable(
  "notification_account_mute",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    legalEntityId: uuid("legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.legalEntityId] }),
    index("notification_account_mute_legal_entity_id_idx").on(table.legalEntityId),
  ],
);
