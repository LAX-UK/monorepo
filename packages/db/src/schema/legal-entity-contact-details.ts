import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";

/**
 * How buyers and LAX reach an organisation: a contact email, a phone number and a website. None
 * of them is checked, so owners and admins change them in place. One row per organisation; with
 * no row, the organisation has given none yet.
 */
export const legalEntityContactDetails = pgTable("legal_entity_contact_details", {
  legalEntityId: uuid("legal_entity_id")
    .primaryKey()
    .references(() => legalEntity.id, { onDelete: "cascade" }),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  updatedByUserId: text("updated_by_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
});
