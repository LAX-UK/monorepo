import {
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { category } from "./categories.js";

export const auctionTypeEnum = pgEnum("auction_type", [
  "english",
  "dutch",
  "sealed",
  "buy_it_now",
]);

export const auctionStatusEnum = pgEnum("auction_status", [
  "draft",
  "scheduled",
  "active",
  "ended",
  "cancelled",
]);

export const auction = pgTable(
  "auction",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sellerId: text("seller_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    images: text("images")
      .array()
      .notNull()
      .default([]),
    categoryId: uuid("category_id").references(() => category.id, {
      onDelete: "set null",
    }),
    auctionType: auctionTypeEnum("auction_type").notNull(),
    startingPrice: numeric("starting_price", { precision: 18, scale: 2 }).notNull(),
    reservePrice: numeric("reserve_price", { precision: 18, scale: 2 }),
    buyNowPrice: numeric("buy_now_price", { precision: 18, scale: 2 }),
    currentPrice: numeric("current_price", { precision: 18, scale: 2 }).notNull(),
    buyerPremiumRate: numeric("buyer_premium_rate", { precision: 5, scale: 4 })
      .notNull()
      .default("0.25"),
    startTime: timestamp("start_time", { mode: "date", withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { mode: "date", withTimezone: true }).notNull(),
    status: auctionStatusEnum("status").notNull().default("draft"),
    winnerId: text("winner_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("auction_seller_id_idx").on(table.sellerId),
    index("auction_category_id_idx").on(table.categoryId),
    index("auction_status_end_time_idx").on(table.status, table.endTime),
  ],
);
