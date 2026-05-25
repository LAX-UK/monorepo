import { relations } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const savedSearch = pgTable(
  "saved_search",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    query: jsonb("query").$type<Record<string, string>>().notNull(),
    notifyEmail: boolean("notify_email").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("saved_search_user_id_idx").on(table.userId)],
);

export const savedSearchRelations = relations(savedSearch, ({ one }) => ({
  user: one(user, {
    fields: [savedSearch.userId],
    references: [user.id],
  }),
}));
