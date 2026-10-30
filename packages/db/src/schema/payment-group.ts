import { sql } from "drizzle-orm";
import {
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";

/**
 * One payment that settles several invoices of the same buyer account ("Pay several"). Each
 * invoice keeps its own `payment` row, which points here through `payment_group_id`; the group
 * carries the one checkout, its total and how it was paid. A single-invoice payment has no group.
 *
 * Status: `open` (checkout issued) → `processing` (bank transfer on its way) → `paid`; `open` or
 * `processing` → `cancelled` when the checkout is cancelled, expires or fails, which hands every
 * invoice back to being due on its own.
 */
export const paymentGroup = pgTable(
  "payment_group",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    buyerLegalEntityId: uuid("buyer_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    /** The member who paid; receives the one receipt. */
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("open"),
    currency: text("currency").notNull().default("GBP"),
    /** The sum of the invoices' amounts; the checkout charges exactly this. */
    totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).notNull(),
    /** `card` or `gb_bank_transfer`, chosen on the total. */
    checkoutRail: text("checkout_rail").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeChargeId: text("stripe_charge_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    /** When it was paid or cancelled. */
    settledAt: timestamp("settled_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    index("payment_group_buyer_legal_entity_id_idx").on(table.buyerLegalEntityId),
    uniqueIndex("payment_group_stripe_payment_intent_id_uidx")
      .on(table.stripePaymentIntentId)
      .where(sql`${table.stripePaymentIntentId} is not null`),
    uniqueIndex("payment_group_stripe_charge_id_uidx")
      .on(table.stripeChargeId)
      .where(sql`${table.stripeChargeId} is not null`),
    check(
      "payment_group_status_check",
      sql`${table.status} in ('open', 'processing', 'paid', 'cancelled')`,
    ),
    check("payment_group_rail_check", sql`${table.checkoutRail} in ('card', 'gb_bank_transfer')`),
    check("payment_group_total_check", sql`${table.totalAmount} > 0`),
  ],
);
