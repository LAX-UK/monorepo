import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { artistProfile } from "./artist-profiles.js";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";
import { sale } from "./sales.js";

export const lotAuctionTypeEnum = pgEnum("auction_type", [
  "english",
  "dutch",
  "sealed",
  "buy_it_now",
]);

export const lotStatusEnum = pgEnum("lot_status", [
  "draft",
  "scheduled",
  "active",
  "ended",
  "cancelled",
  /** no valid winner after anti-shilling re-check at close. */
  "voided",
]);

export const lot = pgTable(
  "lot",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id").references(() => sale.id, { onDelete: "set null" }),
    lotNumber: integer("lot_number"),
    sellerLegalEntityId: uuid("seller_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    /** artist registry FK */
    artistId: uuid("artist_id").references(() => artistProfile.id, {
      onDelete: "restrict",
    }),
    /** gates publish when artist is pending */
    artistReviewRequired: boolean("artist_review_required").notNull().default(false),
    title: text("title").notNull(),
    description: text("description"),
    medium: text("medium"),
    dimensions: text("dimensions"),
    images: text("images").array().notNull().default([]),
    auctionType: lotAuctionTypeEnum("auction_type").notNull(),
    startingPrice: numeric("starting_price", { precision: 18, scale: 2 }).notNull(),
    reservePrice: numeric("reserve_price", { precision: 18, scale: 2 }),
    buyNowPrice: numeric("buy_now_price", { precision: 18, scale: 2 }),
    currentPrice: numeric("current_price", { precision: 18, scale: 2 }).notNull(),
    buyerPremiumRate: numeric("buyer_premium_rate", { precision: 5, scale: 4 })
      .notNull()
      .default("0.25"),
    startTime: timestamp("start_time", { mode: "date", withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { mode: "date", withTimezone: true }).notNull(),
    status: lotStatusEnum("status").notNull().default("draft"),
    /** set when lot is voided (e.g. `no_valid_winner` after anti-shilling at close). */
    voidedReason: text("voided_reason"),
    /** seller entity was archived; admin reviews before unscheduling. */
    archivedSeller: boolean("archived_seller").notNull().default(false),
    winnerId: text("winner_id").references(() => user.id, { onDelete: "set null" }),
    /** winner's acting legal entity at time of win */
    buyerLegalEntityId: uuid("buyer_legal_entity_id").references(() => legalEntity.id, {
      onDelete: "set null",
    }),
    minBidIncrement: numeric("min_bid_increment", { precision: 18, scale: 2 })
      .notNull()
      .default("1.00"),
    dutchDecrementAmount: numeric("dutch_decrement_amount", { precision: 18, scale: 2 }),
    dutchDecrementIntervalMs: integer("dutch_decrement_interval_ms").notNull().default(60_000),
    dutchLastDecrementAt: timestamp("dutch_last_decrement_at", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    /** Catalog/marketing JSON (estimate, provenance, image alts, …) — see `LotMarketingDetails` in @auction/types */
    marketingDetails: jsonb("marketing_details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
    deletedByUserId: text("deleted_by_user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    index("lot_seller_legal_entity_id_idx").on(table.sellerLegalEntityId),
    index("lot_artist_id_idx").on(table.artistId),
    index("lot_artist_review_required_idx").on(table.artistReviewRequired),
    index("lot_buyer_legal_entity_id_idx").on(table.buyerLegalEntityId),
    index("lot_status_end_time_idx").on(table.status, table.endTime),
    index("lot_sale_id_idx").on(table.saleId),
    index("lot_sale_id_status_idx").on(table.saleId, table.status),
    index("lot_not_deleted_idx").on(table.id).where(sql`${table.deletedAt} IS NULL`),
    index("lot_sale_id_not_deleted_idx").on(table.saleId).where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("lot_sale_id_lot_number_uid")
      .on(table.saleId, table.lotNumber)
      .where(sql`${table.saleId} IS NOT NULL AND ${table.lotNumber} IS NOT NULL`),
  ],
);

export const lotRelations = relations(lot, ({ one }) => ({
  sellerLegalEntity: one(legalEntity, {
    fields: [lot.sellerLegalEntityId],
    references: [legalEntity.id],
  }),
  artist: one(artistProfile, {
    fields: [lot.artistId],
    references: [artistProfile.id],
  }),
  buyerLegalEntity: one(legalEntity, {
    fields: [lot.buyerLegalEntityId],
    references: [legalEntity.id],
  }),
}));
