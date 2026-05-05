import { sql } from "drizzle-orm";
import {
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
import { user } from "./auth.js";
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
]);

export const lot = pgTable(
  "lot",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id").references(() => sale.id, { onDelete: "set null" }),
    lotNumber: integer("lot_number"),
    sellerId: text("seller_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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
    winnerId: text("winner_id").references(() => user.id, { onDelete: "set null" }),
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
  },
  (table) => [
    index("lot_seller_id_idx").on(table.sellerId),
    index("lot_status_end_time_idx").on(table.status, table.endTime),
    index("lot_sale_id_idx").on(table.saleId),
    uniqueIndex("lot_sale_id_lot_number_uid")
      .on(table.saleId, table.lotNumber)
      .where(sql`${table.saleId} IS NOT NULL AND ${table.lotNumber} IS NOT NULL`),
  ],
);
