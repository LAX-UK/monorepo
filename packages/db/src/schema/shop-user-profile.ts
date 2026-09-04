import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Shop-local profile keyed by LAX Identity subject (no auth DB FK). */
export const shopUserProfile = pgTable("shop_user_profile", {
  identitySubjectId: text("identity_subject_id").primaryKey(),
  email: text("email"),
  name: text("name"),
  disabledAt: timestamp("disabled_at", { mode: "date", withTimezone: true }),
  mergedIntoSubjectId: text("merged_into_subject_id"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});
