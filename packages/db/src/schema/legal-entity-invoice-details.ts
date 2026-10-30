import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";

/**
 * What an organisation's finance team wants printed on its Bid invoices: where invoices go
 * (billing email), the address to print, and an optional purchase-order reference. One row per
 * organisation; with no row, invoices use the organisation's registered billing address.
 */
export const legalEntityInvoiceDetails = pgTable(
  "legal_entity_invoice_details",
  {
    legalEntityId: uuid("legal_entity_id")
      .primaryKey()
      .references(() => legalEntity.id, { onDelete: "cascade" }),
    billingEmail: text("billing_email"),
    /** The invoice address; all of line 1, city, postcode and country, or none. */
    line1: text("line1"),
    line2: text("line2"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postal_code"),
    country: text("country"),
    poReference: text("po_reference"),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "legal_entity_invoice_details_address_complete",
      sql`(${table.line1} IS NULL AND ${table.city} IS NULL AND ${table.postalCode} IS NULL AND ${table.country} IS NULL)
        OR (${table.line1} IS NOT NULL AND ${table.city} IS NOT NULL AND ${table.postalCode} IS NOT NULL AND ${table.country} IS NOT NULL)`,
    ),
  ],
);
