import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";
import { payment } from "./payments.js";

/**
 * One card dispute Stripe reported on a Bid charge, whether or not a payment matches it. It keeps
 * Stripe's latest copy (status, respond-by deadline, evidence) and what happened to the funds.
 *
 * `allocation_state`: `allocated` once the dispute is put on the invoices it is about (done
 * automatically when the charge paid exactly one invoice); `needs_allocation` while the finance
 * team has to decide, which holds every seller's payout untouched.
 */
export const disputeCase = pgTable(
  "dispute_case",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stripeDisputeId: text("stripe_dispute_id").notNull(),
    stripeChargeId: text("stripe_charge_id").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    amountPence: integer("amount_pence").notNull(),
    currency: text("currency").notNull(),
    reason: text("reason"),
    networkReasonCode: text("network_reason_code"),
    cardBrand: text("card_brand"),
    cardLast4: text("card_last4"),
    /** Stripe's dispute status, as last reported. */
    status: text("status").notNull(),
    /** The card network's respond-by deadline (`evidence_details.due_by`). */
    dueBy: timestamp("due_by", { mode: "date", withTimezone: true }),
    evidenceSubmitted: boolean("evidence_submitted").notNull().default(false),
    chargeRefundable: boolean("charge_refundable"),
    allocationState: text("allocation_state").notNull(),
    fundsWithdrawnAt: timestamp("funds_withdrawn_at", { mode: "date", withTimezone: true }),
    fundsReinstatedAt: timestamp("funds_reinstated_at", { mode: "date", withTimezone: true }),
    stripeCreatedAt: timestamp("stripe_created_at", { mode: "date", withTimezone: true }).notNull(),
    /** When Stripe created the event the stored copy came from; older events never overwrite it. */
    lastEventAt: timestamp("last_event_at", { mode: "date", withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { mode: "date", withTimezone: true }),
    /** Bumped on every staff change, so a stale allocation is refused. */
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("dispute_case_stripe_dispute_id_uidx").on(table.stripeDisputeId),
    index("dispute_case_stripe_charge_id_idx").on(table.stripeChargeId),
    index("dispute_case_needs_allocation_idx")
      .on(table.status)
      .where(sql`${table.allocationState} = 'needs_allocation'`),
    check(
      "dispute_case_allocation_state_check",
      sql`${table.allocationState} in ('allocated', 'needs_allocation')`,
    ),
    check("dispute_case_amount_check", sql`${table.amountPence} >= 0`),
  ],
);

/** The invoices a case's charge paid, linked when the case is recorded. */
export const disputeCaseCandidate = pgTable(
  "dispute_case_candidate",
  {
    caseId: uuid("case_id")
      .notNull()
      .references(() => disputeCase.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payment.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.caseId, table.paymentId] }),
    index("dispute_case_candidate_payment_id_idx").on(table.paymentId),
  ],
);

/**
 * How much of a case one invoice carries, and how much of that comes out of its seller's payout.
 * `clawback` records what the line has done to that payout, so each step happens once.
 */
export const disputeAllocation = pgTable(
  "dispute_allocation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => disputeCase.id, { onDelete: "restrict" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payment.id, { onDelete: "restrict" }),
    sellerLegalEntityId: uuid("seller_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    amountPence: integer("amount_pence").notNull(),
    sellerSharePence: integer("seller_share_pence").notNull(),
    clawback: text("clawback").notNull().default("none"),
    source: text("source").notNull(),
    allocatedByUserId: text("allocated_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("dispute_allocation_case_payment_uidx").on(table.caseId, table.paymentId),
    index("dispute_allocation_payment_id_idx").on(table.paymentId),
    check("dispute_allocation_amount_check", sql`${table.amountPence} > 0`),
    check(
      "dispute_allocation_seller_share_check",
      sql`${table.sellerSharePence} >= 0 and ${table.sellerSharePence} <= ${table.amountPence}`,
    ),
    check(
      "dispute_allocation_clawback_check",
      sql`${table.clawback} in ('none', 'withdrawn', 'reversed')`,
    ),
    check(
      "dispute_allocation_source_check",
      sql`${table.source} in ('automatic', 'staff', 'legacy')`,
    ),
  ],
);
