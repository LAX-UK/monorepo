import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
