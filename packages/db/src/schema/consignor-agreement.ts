import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { artworkRegister } from "./artwork-register.js";
import { shopParty } from "./shop-commerce.js";

/**
 * What a consignor (a client in LAX Admin) agreed: where LAX may offer their works, from and
 * until when, an optional lowest price (pence) and commission (basis points), the signed file and
 * a note (register item ZI-5, docs/design/decision-pack-2026-11-17.md section 1, option B).
 *
 * Replaced by a new version, never edited in place: a trigger lets a current version change only
 * its status, to `replaced` or `retired`, and refuses deletes and truncation. `agreement_id` is
 * the id of the first version, shared by all its versions. Not Bid's `consignment_agreement`,
 * which belongs to a Bid submission. Every constraint in migration 0407 is repeated here, so
 * drizzle-kit never proposes dropping one (the 0407 test checks).
 */
export const consignorAgreement = pgTable(
  "consignor_agreement",
  {
    /** Set by the writer: the first version's id is also its `agreement_id`. */
    id: uuid("id").primaryKey(),
    agreementId: uuid("agreement_id").notNull(),
    version: integer("version").notNull(),
    partyId: uuid("party_id")
      .notNull()
      .references(() => shopParty.id, { onDelete: "restrict" }),
    replacesId: uuid("replaces_id").references((): AnyPgColumn => consignorAgreement.id, {
      onDelete: "restrict",
    }),
    coversLaxBid: boolean("covers_lax_bid").notNull(),
    coversLaxArt: boolean("covers_lax_art").notNull(),
    coversPrivateSale: boolean("covers_private_sale").notNull(),
    /** London calendar days, both inclusive; no end means until retired. */
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }),
    lowestPricePence: integer("lowest_price_pence"),
    /** 1 is 0.01 %; 10000 is 100 %. */
    commissionBasisPoints: integer("commission_basis_points"),
    /** Object-storage key of the signed file. */
    signedFileKey: text("signed_file_key").notNull(),
    note: text("note"),
    status: text("status").$type<"current" | "replaced" | "retired">().notNull().default("current"),
    /** `staff:<user id>`. */
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    replacedAt: timestamp("replaced_at", { mode: "date", withTimezone: true }),
    retiredAt: timestamp("retired_at", { mode: "date", withTimezone: true }),
    /** `staff:<user id>`. */
    retiredBy: text("retired_by"),
  },
  (table) => [
    uniqueIndex("consignor_agreement_version_uid").on(table.agreementId, table.version),
    uniqueIndex("consignor_agreement_current_uid")
      .on(table.agreementId)
      .where(sql`${table.status} = 'current'`),
    uniqueIndex("consignor_agreement_replaces_uid")
      .on(table.replacesId)
      .where(sql`${table.replacesId} IS NOT NULL`),
    index("consignor_agreement_party_idx").on(table.partyId, table.status),
    check("consignor_agreement_version_check", sql`${table.version} >= 1`),
    check(
      "consignor_agreement_lineage_check",
      sql`(${table.version} = 1) = (${table.replacesId} IS NULL) AND (${table.version} = 1) = (${table.agreementId} = ${table.id})`,
    ),
    check(
      "consignor_agreement_places_check",
      sql`${table.coversLaxBid} OR ${table.coversLaxArt} OR ${table.coversPrivateSale}`,
    ),
    check(
      "consignor_agreement_dates_check",
      sql`${table.endsOn} IS NULL OR ${table.endsOn} >= ${table.startsOn}`,
    ),
    check(
      "consignor_agreement_lowest_price_check",
      sql`${table.lowestPricePence} IS NULL OR ${table.lowestPricePence} BETWEEN 1 AND 999999999`,
    ),
    check(
      "consignor_agreement_commission_check",
      sql`${table.commissionBasisPoints} IS NULL OR ${table.commissionBasisPoints} BETWEEN 0 AND 10000`,
    ),
    check(
      "consignor_agreement_file_check",
      sql`char_length(${table.signedFileKey}) BETWEEN 1 AND 512 AND ${table.signedFileKey} ~ '^[A-Za-z0-9][A-Za-z0-9/._-]*$' AND ${table.signedFileKey} !~ '(^|/)\\.{0,2}(/|$)'`,
    ),
    check(
      "consignor_agreement_note_check",
      sql`${table.note} IS NULL OR (char_length(${table.note}) BETWEEN 1 AND 1000 AND ${table.note} = btrim(${table.note}))`,
    ),
    check(
      "consignor_agreement_status_check",
      sql`${table.status} IN ('current', 'replaced', 'retired')`,
    ),
    check(
      "consignor_agreement_replaced_check",
      sql`(${table.status} = 'replaced') = (${table.replacedAt} IS NOT NULL)`,
    ),
    check(
      "consignor_agreement_retired_check",
      sql`(${table.status} = 'retired') = (${table.retiredAt} IS NOT NULL) AND (${table.retiredAt} IS NULL) = (${table.retiredBy} IS NULL)`,
    ),
  ],
);

/**
 * Who consigned each original in the register: a client, or LAX itself ("LAX owns this work").
 * Append-only: the latest row per artwork is its consignor now. Every change after the first
 * carries a reason (a trigger refuses one without).
 */
export const artworkConsignorLink = pgTable(
  "artwork_consignor_link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    registerId: uuid("register_id")
      .notNull()
      .references(() => artworkRegister.id, { onDelete: "restrict" }),
    consignor: text("consignor").$type<"client" | "lax">().notNull(),
    partyId: uuid("party_id").references(() => shopParty.id, { onDelete: "restrict" }),
    changeReason: text("change_reason"),
    /** `staff:<user id>`. */
    setBy: text("set_by").notNull(),
    setAt: timestamp("set_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("artwork_consignor_link_register_uid").on(table.registerId, table.setAt),
    index("artwork_consignor_link_party_idx")
      .on(table.partyId)
      .where(sql`${table.partyId} IS NOT NULL`),
    check("artwork_consignor_link_consignor_check", sql`${table.consignor} IN ('client', 'lax')`),
    check(
      "artwork_consignor_link_party_check",
      sql`(${table.consignor} = 'client') = (${table.partyId} IS NOT NULL)`,
    ),
    check(
      "artwork_consignor_link_reason_check",
      sql`${table.changeReason} IS NULL OR (char_length(${table.changeReason}) BETWEEN 1 AND 500 AND ${table.changeReason} = btrim(${table.changeReason}))`,
    ),
  ],
);
