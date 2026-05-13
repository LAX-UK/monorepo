import { relations } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

/** Stored colour-scheme preference (web + cookie `lax_theme`). */
export const userUiPreference = pgTable("user_ui_preference", {
  userId: text("user_id")
    .primaryKey()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  theme: text("theme").notNull().default("system"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
});

export const userUiPreferenceRelations = relations(userUiPreference, ({ one }) => ({
  user: one(user, {
    fields: [userUiPreference.userId],
    references: [user.id],
  }),
}));
