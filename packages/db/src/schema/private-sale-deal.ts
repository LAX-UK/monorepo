import { sql } from "drizzle-orm";
import {
  bigint,
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
import { artworkRegister } from "./artwork-register.js";
import { user } from "./auth.js";
import { itemSubmission } from "./item-submissions.js";
import { legalEntity } from "./legal-entities.js";
import { marketingEnquiry } from "./marketing-enquiry.js";
import { unsoldLotChoice } from "./unsold-lot-choices.js";
import { uploadObject } from "./upload-objects.js";

const STAGES =
  "'proposed', 'offer', 'agreed', 'cleared', 'invoiced', 'paid', 'released', 'settled', 'cancelled'";

/**
 * A private sale: one work, one seller, one buyer and one agreed price, sold through LAX Bid.
 * Money is in pence, GBP only. The parties sit in their own rows so each side can be shown only
 * what it may see. The deal is never deleted while it has history: the stage history is append-only.
 */
export const privateSaleDeal = pgTable(
  "private_sale_deal",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** What staff and clients quote: PS-0001 upwards. */
    reference: text("reference")
      .notNull()
      .default(sql`('PS-' || lpad(nextval('private_sale_deal_reference_seq')::text, 4, '0'))`),
    stage: text("stage").notNull().default("proposed"),
    itemSubmissionId: uuid("item_submission_id")
      .notNull()
      .references(() => itemSubmission.id, { onDelete: "restrict" }),
    /** The artwork register entry for the work. Optional: a deal may start before the register holds the work. */
    artworkRegisterId: uuid("artwork_register_id").references(() => artworkRegister.id, {
      onDelete: "restrict",
    }),
    sourceEnquiryId: uuid("source_enquiry_id").references(() => marketingEnquiry.id, {
      onDelete: "set null",
    }),
    sourceUnsoldLotChoiceId: uuid("source_unsold_lot_choice_id").references(
      () => unsoldLotChoice.id,
      { onDelete: "set null" },
    ),
    ownerUserId: text("owner_user_id").references(() => user.id, { onDelete: "set null" }),
    priceMinor: bigint("price_minor", { mode: "number" }),
    currency: text("currency").notNull().default("GBP"),
    buyerFeeBps: integer("buyer_fee_bps").notNull().default(0),
    sellerCommissionBps: integer("seller_commission_bps"),
    costsMinor: bigint("costs_minor", { mode: "number" }).notNull().default(0),
    /** A code from the configured VAT list; the list is configuration, so only its shape is checked here. */
    vatTreatment: text("vat_treatment"),
    partiesDisclosed: boolean("parties_disclosed").notNull().default(false),
    offerExpiresAt: timestamp("offer_expires_at", { mode: "date", withTimezone: true }),
    paymentDueAt: timestamp("payment_due_at", { mode: "date", withTimezone: true }),
    collectionDueAt: timestamp("collection_due_at", { mode: "date", withTimezone: true }),
    agreedAt: timestamp("agreed_at", { mode: "date", withTimezone: true }),
    agreedByUserId: text("agreed_by_user_id").references(() => user.id, { onDelete: "set null" }),
    invoicedByUserId: text("invoiced_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** The invoice's reference in the finance system that issued it; null until one exists. */
    invoiceReference: text("invoice_reference"),
    cancelReason: text("cancel_reason"),
    cancelledAt: timestamp("cancelled_at", { mode: "date", withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("private_sale_deal_reference_uidx").on(table.reference),
    index("private_sale_deal_submission_idx").on(table.itemSubmissionId),
    index("private_sale_deal_owner_idx").on(table.ownerUserId),
    // One deal per work: only a cancelled deal frees it. A settled work has been sold and stays taken.
    uniqueIndex("private_sale_deal_one_open_per_work_uidx")
      .on(table.itemSubmissionId)
      .where(sql`${table.stage} <> 'cancelled'`),
    index("private_sale_deal_artwork_register_idx")
      .on(table.artworkRegisterId)
      .where(sql`${table.artworkRegisterId} IS NOT NULL`),
    index("private_sale_deal_open_idx")
      .on(table.updatedAt)
      .where(sql`${table.stage} NOT IN ('settled', 'cancelled')`),
    check("private_sale_deal_stage_check", sql.raw(`"stage" IN (${STAGES})`)),
    check("private_sale_deal_currency_check", sql`${table.currency} = 'GBP'`),
    check(
      "private_sale_deal_price_check",
      sql`${table.priceMinor} IS NULL OR ${table.priceMinor} > 0`,
    ),
    check("private_sale_deal_buyer_fee_check", sql`${table.buyerFeeBps} BETWEEN 0 AND 10000`),
    check(
      "private_sale_deal_commission_check",
      sql`${table.sellerCommissionBps} IS NULL OR ${table.sellerCommissionBps} BETWEEN 0 AND 10000`,
    ),
    check("private_sale_deal_costs_check", sql`${table.costsMinor} >= 0`),
    check("private_sale_deal_version_check", sql`${table.version} >= 1`),
    check(
      "private_sale_deal_one_source_check",
      sql`num_nonnulls(${table.sourceEnquiryId}, ${table.sourceUnsoldLotChoiceId}) <= 1`,
    ),
    // An agreed price exists from agreement on; a cancelled deal keeps whatever it had.
    check(
      "private_sale_deal_agreed_price_check",
      sql`${table.stage} NOT IN ('agreed', 'cleared', 'invoiced', 'paid', 'released', 'settled') OR (${table.priceMinor} IS NOT NULL AND ${table.agreedAt} IS NOT NULL)`,
    ),
    check(
      "private_sale_deal_invoiced_check",
      sql`${table.stage} NOT IN ('invoiced', 'paid', 'released', 'settled') OR (${table.vatTreatment} IS NOT NULL AND ${table.sellerCommissionBps} IS NOT NULL AND ${table.paymentDueAt} IS NOT NULL)`,
    ),
    check(
      "private_sale_deal_cancelled_check",
      sql`(${table.stage} = 'cancelled') = (${table.cancelReason} IS NOT NULL AND ${table.cancelledAt} IS NOT NULL)`,
    ),
  ],
);

/** The seller and the buyer of a deal. The buyer's row is added when the buyer is named. */
export const privateSaleDealParty = pgTable(
  "private_sale_deal_party",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => privateSaleDeal.id, { onDelete: "restrict" }),
    role: text("role").notNull(),
    legalEntityId: uuid("legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    /** The member acting for the legal entity on this deal. */
    actingUserId: text("acting_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("private_sale_deal_party_role_uidx").on(table.dealId, table.role),
    index("private_sale_deal_party_entity_idx").on(table.legalEntityId),
    check("private_sale_deal_party_role_check", sql`${table.role} IN ('seller', 'buyer')`),
  ],
);

/**
 * One row per stage change, written with the change and never altered. `from_stage` is null for
 * the row that opens the deal; `actor_user_id` is null when the system made the change.
 */
export const privateSaleDealStageHistory = pgTable(
  "private_sale_deal_stage_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => privateSaleDeal.id, { onDelete: "restrict" }),
    fromStage: text("from_stage"),
    toStage: text("to_stage").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("private_sale_deal_stage_history_deal_idx").on(table.dealId, table.createdAt),
    check(
      "private_sale_deal_stage_history_stage_check",
      sql.raw(
        `"to_stage" IN (${STAGES}) AND ("from_stage" IS NULL OR "from_stage" IN (${STAGES}))`,
      ),
    ),
  ],
);

/**
 * References to what a deal holds: the private sale terms and NDA (with who accepted which
 * version, and when), the condition report, provenance and the invoice. The file lives in object
 * storage; this row points at it.
 */
export const privateSaleDealDocument = pgTable(
  "private_sale_deal_document",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => privateSaleDeal.id, { onDelete: "restrict" }),
    kind: text("kind").notNull(),
    audience: text("audience").notNull().default("staff"),
    legalEntityId: uuid("legal_entity_id").references(() => legalEntity.id, {
      onDelete: "restrict",
    }),
    version: text("version"),
    uploadObjectId: uuid("upload_object_id").references(() => uploadObject.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at", { mode: "date", withTimezone: true }),
    acceptedByUserId: text("accepted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("private_sale_deal_document_deal_idx").on(table.dealId),
    // A party accepts a version of the terms or NDA once.
    uniqueIndex("private_sale_deal_document_acceptance_uidx")
      .on(table.dealId, table.legalEntityId, table.kind, table.version)
      .where(sql`${table.acceptedAt} IS NOT NULL`),
    check(
      "private_sale_deal_document_kind_check",
      sql`${table.kind} IN ('terms', 'nda', 'condition_report', 'provenance', 'invoice', 'other')`,
    ),
    check(
      "private_sale_deal_document_audience_check",
      sql`${table.audience} IN ('staff', 'seller', 'buyer', 'both')`,
    ),
    check(
      "private_sale_deal_document_acceptance_check",
      sql`${table.acceptedAt} IS NULL OR (${table.legalEntityId} IS NOT NULL AND ${table.version} IS NOT NULL)`,
    ),
  ],
);

const PAYMENT_STATUSES = "'open', 'processing', 'paid', 'cancelled', 'refunded'";

/**
 * The buyer's payment for a deal: one hosted checkout for the price plus any buyer's fee, paid by
 * card or bank transfer. Money is in pence, GBP only. A deal has at most one live payment (open,
 * processing or paid); a cancelled one hands the deal back to being due.
 *
 * Status: `open` -> `processing` (bank transfer on its way) -> `paid` -> `refunded`; `open` or
 * `processing` -> `cancelled` when the checkout is cancelled, expires or fails.
 */
export const privateSaleDealPayment = pgTable(
  "private_sale_deal_payment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => privateSaleDeal.id, { onDelete: "restrict" }),
    buyerLegalEntityId: uuid("buyer_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("open"),
    /** `card` or `gb_bank_transfer`, chosen on the amount. */
    rail: text("rail").notNull(),
    currency: text("currency").notNull().default("GBP"),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeChargeId: text("stripe_charge_id"),
    refundedMinor: bigint("refunded_minor", { mode: "number" }).notNull().default(0),
    stripeRefundId: text("stripe_refund_id"),
    paidAt: timestamp("paid_at", { mode: "date", withTimezone: true }),
    refundedAt: timestamp("refunded_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("private_sale_deal_payment_deal_idx").on(table.dealId),
    index("private_sale_deal_payment_buyer_idx").on(table.buyerLegalEntityId),
    // One live payment per deal, so a buyer cannot pay twice.
    uniqueIndex("private_sale_deal_payment_live_uidx")
      .on(table.dealId)
      .where(sql`${table.status} IN ('open', 'processing', 'paid')`),
    uniqueIndex("private_sale_deal_payment_intent_uidx")
      .on(table.stripePaymentIntentId)
      .where(sql`${table.stripePaymentIntentId} IS NOT NULL`),
    uniqueIndex("private_sale_deal_payment_charge_uidx")
      .on(table.stripeChargeId)
      .where(sql`${table.stripeChargeId} IS NOT NULL`),
    check("private_sale_deal_payment_status_check", sql.raw(`"status" IN (${PAYMENT_STATUSES})`)),
    check(
      "private_sale_deal_payment_rail_check",
      sql`${table.rail} IN ('card', 'gb_bank_transfer')`,
    ),
    check("private_sale_deal_payment_currency_check", sql`${table.currency} = 'GBP'`),
    check("private_sale_deal_payment_amount_check", sql`${table.amountMinor} > 0`),
    check(
      "private_sale_deal_payment_refund_check",
      sql`${table.refundedMinor} >= 0 AND ${table.refundedMinor} <= ${table.amountMinor}`,
    ),
    check(
      "private_sale_deal_payment_paid_check",
      sql`${table.status} NOT IN ('paid', 'refunded') OR ${table.paidAt} IS NOT NULL`,
    ),
  ],
);
