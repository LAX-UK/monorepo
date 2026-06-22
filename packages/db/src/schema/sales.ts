import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";
import { venue } from "./venues.js";

/**
 * Band-based buyer-premium tier (stored in `sale.buyer_premium_tiers`).
 * `hammerThresholdMinor` is the inclusive lower bound of the band in minor units (pence for GBP).
 * `rate` is a decimal string with 4 d.p. ("0.1500" = 15%).
 * Tiers are stored ascending by threshold; the rate that applies to the **whole** hammer
 * is the one whose threshold is the highest ≤ hammer.
 */
export type BuyerPremiumTier = {
  hammerThresholdMinor: number;
  rate: string;
};

/**
 * Single curated press/news link stored in `sale.press_coverage` JSONB.
 */
export type SalePressRef = {
  url: string;
  headline: string;
  outletName: string;
  publishedAt?: string;
  excerpt?: string;
  mentionType?: "feature" | "interview" | "quote" | "roundup";
};

/**
 * Single auction-day event media item stored in `sale.auction_day_images` JSONB.
 * `mediaType` absent or "image" → photo; "video" → video clip.
 */
export type SaleDayPhotoRef = {
  mediaType?: "image" | "video";
  key: string;
  caption?: string;
  alt?: string;
  posterKey?: string;
};

export const saleStatusEnum = pgEnum("sale_status", [
  "draft",
  "scheduled",
  "active",
  "ended",
  "cancelled",
]);

export const saleDeliveryModeEnum = pgEnum("sale_delivery_mode", ["online", "onsite", "hybrid"]);

export const sale = pgTable(
  "sale",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    coverImages: text("cover_images").array().notNull().default([]),
    deliveryMode: saleDeliveryModeEnum("delivery_mode").notNull().default("onsite"),
    /**
     * When false (default), hybrid online bids require clerk Go Live + lot on block.
     * When true, online bids follow the catalog window before Go Live (legacy open mode).
     */
    allowOnlineBidsBeforeGoLive: boolean("allow_online_bids_before_go_live")
      .notNull()
      .default(false),
    streamUrl: text("stream_url"),
    locationName: text("location_name"),
    locationAddress: text("location_address"),
    locationMapUrl: text("location_map_url"),
    locationAddressLine1: text("location_address_line1"),
    locationAddressLine2: text("location_address_line2"),
    locationCity: text("location_city"),
    locationCounty: text("location_county"),
    locationPostcode: text("location_postcode"),
    locationCountry: text("location_country"),
    status: saleStatusEnum("status").notNull().default("draft"),
    startTime: timestamp("start_time", { mode: "date", withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { mode: "date", withTimezone: true }).notNull(),
    previewStartTime: timestamp("preview_start_time", {
      mode: "date",
      withTimezone: true,
    }),
    buyerPremiumRate: numeric("buyer_premium_rate", { precision: 5, scale: 4 })
      .notNull()
      .default("0.25"),
    /**
     * Optional band-based tier override. When non-null and non-empty, the policy factory
     * uses this in preference to the per-lot `buyer_premium_rate`. See
     * `docs/runbooks/buyer-premium-tiers.md`.
     */
    buyerPremiumTiers: jsonb("buyer_premium_tiers").$type<BuyerPremiumTier[] | null>(),
    terms: text("terms"),
    /** Auction-day event photos. Only meaningful for onsite/hybrid; empty array by default. */
    auctionDayImages: jsonb("auction_day_images").$type<SaleDayPhotoRef[]>().notNull().default([]),
    /** Curated external press/news links. Visible across all sale statuses. */
    pressCoverage: jsonb("press_coverage").$type<SalePressRef[]>().notNull().default([]),
    createdByLegalEntityId: uuid("created_by_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    venueId: uuid("venue_id").references(() => venue.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
    deletedByUserId: text("deleted_by_user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    index("sale_status_end_time_idx").on(table.status, table.endTime),
    index("sale_created_by_legal_entity_id_idx").on(table.createdByLegalEntityId),
    index("sale_venue_id_idx").on(table.venueId),
    index("sale_start_time_idx").on(table.startTime),
    index("sale_not_deleted_idx").on(table.id).where(sql`${table.deletedAt} IS NULL`),
    check("sale_end_after_start", sql`${table.endTime} > ${table.startTime}`),
  ],
);

export const saleRelations = relations(sale, ({ one }) => ({
  createdByLegalEntity: one(legalEntity, {
    fields: [sale.createdByLegalEntityId],
    references: [legalEntity.id],
  }),
  venue: one(venue, {
    fields: [sale.venueId],
    references: [venue.id],
  }),
}));
