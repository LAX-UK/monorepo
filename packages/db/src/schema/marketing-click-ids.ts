import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const marketingClickIds = pgTable("marketing_click_ids", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  fbp: text("fbp"),
  fbc: text("fbc"),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
});
