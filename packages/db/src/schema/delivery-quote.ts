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
import { lot } from "./lots.js";

/**
 * A courier quote for delivering a won lot to its buyer account: asked for by one of the
 * account's payers, priced by the saleroom team, then accepted or withdrawn by the buyer. A lot
 * carries at most one live quote per account; asking again after a withdrawal adds a new row, so
 * earlier quotes stay as history.
 */
export const deliveryQuote = pgTable(
  "delivery_quote",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "cascade" }),
    buyerLegalEntityId: uuid("buyer_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    status: text("status").notNull(),
    /** Where the buyer wants the work delivered, as they wrote it. */
    destination: text("destination").notNull(),
    /** The price, set when the team quotes. */
    amount: numeric("amount", { precision: 18, scale: 2 }),
    currency: text("currency").notNull().default("GBP"),
    /** What the price covers (service, timing), written by the team. */
    quoteNote: text("quote_note"),
    requestedByUserId: text("requested_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    requestedAt: timestamp("requested_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    quotedByUserId: text("quoted_by_user_id").references(() => user.id, { onDelete: "set null" }),
    quotedAt: timestamp("quoted_at", { mode: "date", withTimezone: true }),
    /** Who accepted or withdrew it, and when. */
    decidedByUserId: text("decided_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("delivery_quote_live_uidx")
      .on(table.lotId, table.buyerLegalEntityId)
      .where(sql`${table.status} IN ('requested', 'quoted', 'accepted')`),
    index("delivery_quote_buyer_legal_entity_id_idx").on(table.buyerLegalEntityId),
    index("delivery_quote_requested_idx")
      .on(table.requestedAt)
      .where(sql`${table.status} = 'requested'`),
    check(
      "delivery_quote_status_check",
      sql`${table.status} IN ('requested', 'quoted', 'accepted', 'withdrawn')`,
    ),
    check(
      "delivery_quote_amount_check",
      sql`(${table.status} NOT IN ('quoted', 'accepted') OR ${table.amount} IS NOT NULL) AND (${table.amount} IS NULL OR ${table.amount} > 0)`,
    ),
  ],
);
