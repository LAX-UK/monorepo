import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { shopOrder } from "./shop-commerce.js";

/**
 * Where LAX Shop delivers (see `@auction/shop-domain` delivery-regions): one row per region with
 * its lead times in working days and an optional fixed price in pence (empty means it is quoted).
 * The four regions are seeded by the migration and only edited, never added or removed; the
 * region's name and countries live in the domain.
 */
export const shopDeliveryRegion = pgTable(
  "shop_delivery_region",
  {
    id: text("id").primaryKey(),
    standardMinDays: integer("standard_min_days").notNull(),
    standardMaxDays: integer("standard_max_days").notNull(),
    specialistMinDays: integer("specialist_min_days").notNull(),
    specialistMaxDays: integer("specialist_max_days").notNull(),
    fixedPricePence: integer("fixed_price_pence"),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    /** The staff member who last changed the row; `null` for the seeded values. */
    updatedBySubjectId: text("updated_by_subject_id"),
  },
  (table) => [
    check(
      "shop_delivery_region_id_known",
      sql`${table.id} IN ('uk', 'eu', 'north_america', 'asia_pacific')`,
    ),
    check(
      "shop_delivery_region_standard_days",
      sql`${table.standardMinDays} BETWEEN 1 AND 120 AND ${table.standardMaxDays} BETWEEN ${table.standardMinDays} AND 120`,
    ),
    check(
      "shop_delivery_region_specialist_days",
      sql`${table.specialistMinDays} BETWEEN 1 AND 120 AND ${table.specialistMaxDays} BETWEEN ${table.specialistMinDays} AND 120`,
    ),
    check(
      "shop_delivery_region_price_range",
      sql`${table.fixedPricePence} IS NULL OR ${table.fixedPricePence} BETWEEN 1 AND 10000000`,
    ),
  ],
);

/** The countries LAX Shop does not deliver to; collection is offered to a buyer there instead. */
export const shopDeliveryRestrictedCountry = pgTable(
  "shop_delivery_restricted_country",
  {
    countryCode: text("country_code").primaryKey(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("shop_delivery_restricted_country_code", sql`${table.countryCode} ~ '^[A-Z]{2}$'`),
  ],
);

/**
 * A buyer's request for a delivery quote on an order going outside the UK. The order holds the
 * prints (its checkout expiry is the hold) and carries the address; this row carries the quote:
 * the status uses the saleroom's quote steps (requested, quoted, accepted, withdrawn), and a
 * withdrawn quote says why. One row per order; asking again after a request ends is a new order.
 */
export const shopDeliveryQuote = pgTable(
  "shop_delivery_quote",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => shopOrder.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("requested"),
    /** The region the country sits in, or null for a country outside the four regions. */
    regionId: text("region_id"),
    destinationCountry: text("destination_country").notNull(),
    /** When the held prints are released if the quote has not been paid. */
    holdUntil: timestamp("hold_until", { mode: "date", withTimezone: true }).notNull(),
    requestedAt: timestamp("requested_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    /** Set when staff quote: the delivery price the buyer pays with the prints. */
    quotedPricePence: integer("quoted_price_pence"),
    /** Who carries it, as staff name them: "DHL Express". Required once a price is set. */
    quotedCarrier: text("quoted_carrier"),
    quotedService: text("quoted_service"),
    quotedLeadTimeNote: text("quoted_lead_time_note"),
    quotedAt: timestamp("quoted_at", { mode: "date", withTimezone: true }),
    quotedBySubjectId: text("quoted_by_subject_id"),
    decidedAt: timestamp("decided_at", { mode: "date", withTimezone: true }),
    /** Why a withdrawn quote ended: cancelled_by_buyer, cannot_deliver or expired. */
    endReason: text("end_reason"),
    /** Why staff turned a request down, for the buyer's email and the order's record. */
    declineNote: text("decline_note"),
    /**
     * For a guest's request only: keyed hashes of the client IP and of the browser's basket
     * token, so open holds can be capped per IP and per browser without storing either. Never
     * set for a signed-in buyer, and not read once the request has ended.
     */
    guestIpHash: text("guest_ip_hash"),
    basketTokenHash: text("basket_token_hash"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shop_delivery_quote_order_uid").on(table.orderId),
    index("shop_delivery_quote_open_hold_idx")
      .on(table.holdUntil)
      .where(sql`${table.status} IN ('requested', 'quoted')`),
    index("shop_delivery_quote_open_ip_idx")
      .on(table.guestIpHash)
      .where(sql`${table.status} IN ('requested', 'quoted') AND ${table.guestIpHash} IS NOT NULL`),
    index("shop_delivery_quote_open_basket_token_idx")
      .on(table.basketTokenHash)
      .where(
        sql`${table.status} IN ('requested', 'quoted') AND ${table.basketTokenHash} IS NOT NULL`,
      ),
    check(
      "shop_delivery_quote_status_check",
      sql`${table.status} IN ('requested', 'quoted', 'accepted', 'withdrawn')`,
    ),
    check(
      "shop_delivery_quote_region_known",
      sql`${table.regionId} IS NULL OR ${table.regionId} IN ('eu', 'north_america', 'asia_pacific')`,
    ),
    check("shop_delivery_quote_country_code", sql`${table.destinationCountry} ~ '^[A-Z]{2}$'`),
    check(
      "shop_delivery_quote_end_reason_check",
      sql`(${table.status} = 'withdrawn') = (${table.endReason} IS NOT NULL) AND (${table.endReason} IS NULL OR ${table.endReason} IN ('cancelled_by_buyer', 'cannot_deliver', 'expired'))`,
    ),
    check(
      "shop_delivery_quote_carrier_check",
      sql`${table.status} NOT IN ('quoted', 'accepted') OR length(btrim(${table.quotedCarrier})) > 0`,
    ),
    check(
      "shop_delivery_quote_price_check",
      sql`(${table.status} NOT IN ('quoted', 'accepted') OR ${table.quotedPricePence} > 0) AND (${table.quotedPricePence} IS NULL OR ${table.quotedPricePence} BETWEEN 1 AND 10000000)`,
    ),
  ],
);
