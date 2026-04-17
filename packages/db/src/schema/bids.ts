import { boolean, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { auction } from "./auctions.js";
import { user } from "./auth.js";

export const bid = pgTable(
  "bid",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    auctionId: uuid("auction_id")
      .notNull()
      .references(() => auction.id, { onDelete: "cascade" }),
    bidderId: text("bidder_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    isWinning: boolean("is_winning").notNull().default(false),
    isAutoBid: boolean("is_auto_bid").notNull().default(false),
    maxAutoBidAmount: numeric("max_auto_bid_amount", { precision: 18, scale: 2 }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("bid_auction_id_amount_idx").on(table.auctionId, table.amount),
    index("bid_bidder_id_idx").on(table.bidderId),
  ],
);
