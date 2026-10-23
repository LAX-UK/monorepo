import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";

/**
 * A person's saved postal addresses, shared by every LAX product. Identity owns them so one
 * address book serves Bid, Shop and Art checkout; products read it through the issuer and keep
 * their own snapshot on an invoice or order, which is history and never changes.
 *
 * At most one address is the default shipping address and one the default billing address
 * (partial unique indexes). The limit per person is enforced by the issuer's address service.
 */
export const identityAddress = pgTable(
  "identity_address",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectId: text("subject_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    recipientName: text("recipient_name").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    region: text("region"),
    postcode: text("postcode").notNull(),
    /** ISO 3166-1 alpha-2, upper case. */
    country: text("country").notNull(),
    /** E.164, for the courier. Contact information only, never a sign-in factor. */
    phone: text("phone"),
    isDefaultShipping: boolean("is_default_shipping").notNull().default(false),
    isDefaultBilling: boolean("is_default_billing").notNull().default(false),
    /** Bumped on every change so a stale edit from another tab is refused, not silently applied. */
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("identity_address_subject_idx").on(table.subjectId),
    uniqueIndex("identity_address_default_shipping_uidx")
      .on(table.subjectId)
      .where(sql`${table.isDefaultShipping}`),
    uniqueIndex("identity_address_default_billing_uidx")
      .on(table.subjectId)
      .where(sql`${table.isDefaultBilling}`),
    check("identity_address_country_iso", sql`${table.country} ~ '^[A-Z]{2}$'`),
  ],
);
