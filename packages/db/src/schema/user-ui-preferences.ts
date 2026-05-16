import { relations } from "drizzle-orm";
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

/** Stored colour-scheme preference (web + cookie `lax_theme`). */
export const userUiPreference = pgTable("user_ui_preference", {
  userId: text("user_id")
    .primaryKey()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  theme: text("theme").notNull().default("system"),
  viewLotsDefault: text("view_lots_default").notNull().default("auto"),
  viewArtistsDefault: text("view_artists_default").notNull().default("auto"),
  viewSalesDefault: text("view_sales_default").notNull().default("auto"),
  density: text("density").notNull().default("comfortable"),
  viewSync: boolean("view_sync").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
});

export const userUiPreferenceRelations = relations(userUiPreference, ({ one }) => ({
  user: one(user, {
    fields: [userUiPreference.userId],
    references: [user.id],
  }),
}));
