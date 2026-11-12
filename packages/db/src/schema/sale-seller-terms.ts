import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { consignmentAgreement } from "./consignment-agreements.js";
import { legalEntity } from "./legal-entities.js";
import { lot } from "./lots.js";
import { payment } from "./payments.js";

/**
 * What a seller is paid for a sale, fixed when the buyer's invoice is raised: one row per buyer
 * payment. The rate comes from the lot's signed consignment agreement and is charged on the hammer,
 * with VAT on the commission; the buyer's premium stays with LAX. `basis` is `agreement` (every
 * figure present and adding up exactly), `lax_owned` (LAX's own stock: nothing is paid out) or
 * `held` (a fact is missing; `held_reason` says which). The migration's CHECK constraints keep each
 * basis to its own shape.
 */
export const saleSellerTerms = pgTable(
  "sale_seller_terms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payment.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "cascade" }),
    sellerLegalEntityId: uuid("seller_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    agreementId: uuid("agreement_id").references(() => consignmentAgreement.id, {
      onDelete: "restrict",
    }),
    basis: text("basis").notNull(),
    heldReason: text("held_reason"),
    hammerPence: bigint("hammer_pence", { mode: "number" }).notNull(),
    premiumPence: bigint("premium_pence", { mode: "number" }).notNull(),
    commissionBps: integer("commission_bps"),
    commissionPence: bigint("commission_pence", { mode: "number" }),
    commissionVatTreatment: text("commission_vat_treatment"),
    commissionVatBps: integer("commission_vat_bps"),
    commissionVatPence: bigint("commission_vat_pence", { mode: "number" }),
    /** Reserved for charges beyond commission and VAT; empty while no agreement carries any. */
    otherCharges: jsonb("other_charges").notNull().default([]),
    sellerNetPence: bigint("seller_net_pence", { mode: "number" }),
    /** The old-rule fee, kept for audit when a payment raised before the rule is recomputed. */
    legacyPlatformFeePence: bigint("legacy_platform_fee_pence", { mode: "number" }),
    ruleVersion: text("rule_version").notNull(),
    /** How the row was made: `raised`, `recomputed_at_payout` or `agreement_recorded`. */
    source: text("source").notNull().default("raised"),
    computedAt: timestamp("computed_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("sale_seller_terms_payment_id_uidx").on(table.paymentId),
    index("sale_seller_terms_lot_id_idx").on(table.lotId),
    index("sale_seller_terms_seller_idx").on(table.sellerLegalEntityId),
    index("sale_seller_terms_held_idx").on(table.computedAt).where(sql`${table.basis} = 'held'`),
  ],
);
