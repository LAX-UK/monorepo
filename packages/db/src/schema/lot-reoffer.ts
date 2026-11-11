import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { bidInvoice } from "./bid-invoice.js";
import { bid } from "./bids.js";
import { buyerDefault } from "./buyer-default.js";
import { legalEntity } from "./legal-entities.js";
import { lot } from "./lots.js";
import { payment } from "./payments.js";

/**
 * The seller's answer to a question about their lot, kept as a record. The subject says what the
 * answer is about: `lot_reoffer` today, and other kinds of request later. The terms the seller
 * saw are frozen in `terms_snapshot`, so the answer is read against what was asked even after the
 * lot changes. Silence is never a yes: a request the seller did not answer lapses.
 */
export const sellerConsent = pgTable(
  "seller_consent",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    sellerLegalEntityId: uuid("seller_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "cascade" }),
    /** The amount, the original hammer, the proceeds at both and the reserve (evidence only). */
    termsSnapshot: jsonb("terms_snapshot").notNull(),
    status: text("status").notNull(),
    /** How the answer arrived; `house_stock` when LAX owns the lot and nobody needs to answer. */
    channel: text("channel"),
    answeredByUserId: text("answered_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    answeredAt: timestamp("answered_at", { mode: "date", withTimezone: true }),
    /** What staff were told, required whenever staff record the answer for the seller. */
    note: text("note"),
    requestedAt: timestamp("requested_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    dueAt: timestamp("due_at", { mode: "date", withTimezone: true }),
    remindedAt: timestamp("reminded_at", { mode: "date", withTimezone: true }),
    /** What a refusing seller wants done with the lot. */
    preferredNext: text("preferred_next"),
  },
  (table) => [
    // One request per subject; a lapsed one is answered late on the same row.
    uniqueIndex("seller_consent_subject_uidx").on(table.subjectType, table.subjectId),
    index("seller_consent_lot_id_idx").on(table.lotId),
    index("seller_consent_seller_idx").on(table.sellerLegalEntityId, table.status),
    // The lapse and reminder sweeps read the requests still waiting.
    index("seller_consent_open_due_idx")
      .on(table.dueAt)
      .where(sql`${table.status} = 'requested'`),
    check("seller_consent_subject_type_check", sql`${table.subjectType} IN ('lot_reoffer')`),
    check(
      "seller_consent_status_check",
      sql`${table.status} IN ('requested', 'given', 'refused', 'lapsed', 'not_needed')`,
    ),
    check(
      "seller_consent_channel_check",
      sql`${table.channel} IS NULL OR ${table.channel} IN ('workspace', 'recorded_by_staff', 'house_stock')`,
    ),
    check(
      "seller_consent_preferred_next_check",
      sql`${table.preferredNext} IS NULL OR (${table.status} = 'refused' AND ${table.preferredNext} IN ('later_sale', 'return_to_me', 'talk_to_us'))`,
    ),
    check(
      "seller_consent_staff_note_check",
      sql`${table.channel} IS DISTINCT FROM 'recorded_by_staff' OR char_length(btrim(coalesce(${table.note}, ''))) > 0`,
    ),
    check(
      "seller_consent_note_length",
      sql`${table.note} IS NULL OR char_length(${table.note}) <= 1000`,
    ),
  ],
);

/**
 * One offer of a defaulted lot to one bidder, at the amount that bidder bid. A default can lead
 * to several offers, one after another (at most three); the lot is offered to one bidder at a time.
 * Only an accepted offer changes the lot (see the lot's `reaward` transition): until then the
 * original hammer and buyer stand on `buyer_default`.
 */
export const lotReoffer = pgTable(
  "lot_reoffer",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "cascade" }),
    buyerDefaultId: uuid("buyer_default_id")
      .notNull()
      .references(() => buyerDefault.id, { onDelete: "cascade" }),
    /** 1 for the first offer of the default, 2 for the next, up to 3. */
    sequence: smallint("sequence").notNull(),
    offeredUserId: text("offered_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    offeredLegalEntityId: uuid("offered_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    sourceBidId: uuid("source_bid_id")
      .notNull()
      .references(() => bid.id, { onDelete: "cascade" }),
    /** The bidder's own bid, in whole pence: the price of the offer. It is never changed. */
    amountPence: bigint("amount_pence", { mode: "number" }).notNull(),
    status: text("status").notNull(),
    sellerConsentId: uuid("seller_consent_id")
      .notNull()
      .references(() => sellerConsent.id, { onDelete: "restrict" }),
    offerSentAt: timestamp("offer_sent_at", { mode: "date", withTimezone: true }),
    offerEndsAt: timestamp("offer_ends_at", { mode: "date", withTimezone: true }),
    /** When the bidder accepted or declined. */
    respondedAt: timestamp("responded_at", { mode: "date", withTimezone: true }),
    /**
     * When the lot was re-awarded to this bidder. Written once, in the transaction that makes them
     * the winner, and the only thing that makes a repeated re-award a no-op: a lot whose buyer later
     * defaulted again is never re-awarded from this offer.
     */
    reawardedAt: timestamp("reawarded_at", { mode: "date", withTimezone: true }),
    declineReason: text("decline_reason"),
    /** The invoice and payment raised for the bidder once they accept. */
    invoiceId: uuid("invoice_id").references(() => bidInvoice.id, { onDelete: "set null" }),
    paymentId: uuid("payment_id").references(() => payment.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    closedBy: text("closed_by").references(() => user.id, { onDelete: "set null" }),
    closeReason: text("close_reason"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The lot is offered to one bidder at a time: one offer waiting on someone per lot.
    uniqueIndex("lot_reoffer_one_open_per_lot_uidx")
      .on(table.lotId)
      .where(sql`${table.status} IN ('awaiting_seller', 'ready', 'offered')`),
    uniqueIndex("lot_reoffer_default_sequence_uidx").on(table.buyerDefaultId, table.sequence),
    index("lot_reoffer_lot_id_idx").on(table.lotId),
    index("lot_reoffer_seller_consent_idx").on(table.sellerConsentId),
    index("lot_reoffer_offered_user_idx").on(table.offeredUserId, table.status),
    // The expiry sweep reads the offers still out.
    index("lot_reoffer_offered_ends_idx")
      .on(table.offerEndsAt)
      .where(sql`${table.status} = 'offered'`),
    // At most three offers per default (the domain's MAX_REOFFERS_PER_DEFAULT).
    check("lot_reoffer_sequence_check", sql`${table.sequence} BETWEEN 1 AND 3`),
    check("lot_reoffer_amount_check", sql`${table.amountPence} > 0`),
    check(
      "lot_reoffer_status_check",
      sql`${table.status} IN ('awaiting_seller', 'ready', 'offered', 'accepted', 'declined', 'expired', 'seller_declined', 'seller_lapsed', 'withdrawn')`,
    ),
    check(
      "lot_reoffer_reawarded_check",
      sql`${table.reawardedAt} IS NULL OR (${table.status} = 'accepted' AND ${table.respondedAt} IS NOT NULL)`,
    ),
    check(
      "lot_reoffer_text_length",
      sql`(${table.declineReason} IS NULL OR char_length(${table.declineReason}) <= 500) AND (${table.closeReason} IS NULL OR char_length(${table.closeReason}) <= 1000)`,
    ),
  ],
);
