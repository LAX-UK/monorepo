import { relations } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const externalAccount = pgTable(
  "external_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    email: text("email"),
    metadata: jsonb("metadata").notNull().default({}),
    linkedAt: timestamp("linked_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("external_accounts_provider_external_id_uidx").on(table.provider, table.externalId),
    index("external_accounts_email_provider_idx").on(table.email, table.provider),
    index("external_accounts_user_id_idx").on(table.userId),
  ],
);

export const externalAccountRelations = relations(externalAccount, ({ one }) => ({
  user: one(user, {
    fields: [externalAccount.userId],
    references: [user.id],
  }),
}));
