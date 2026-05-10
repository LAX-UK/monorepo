import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { legalEntity } from "./legal-entities.js";
import { lot } from "./lots.js";

export const bid = pgTable(
  "bid",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "cascade" }),
    bidderId: text("bidder_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Acting legal entity at time of bid; bidderId remains the human audit trail. */
    buyerLegalEntityId: uuid("buyer_legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    isWinning: boolean("is_winning").notNull().default(false),
    isAutoBid: boolean("is_auto_bid").notNull().default(false),
    maxAutoBidAmount: numeric("max_auto_bid_amount", { precision: 18, scale: 2 }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("bid_lot_id_amount_idx").on(table.lotId, table.amount),
    index("bid_lot_id_amount_created_at_idx").on(table.lotId, table.amount, table.createdAt),
    index("bid_bidder_id_idx").on(table.bidderId),
    index("bid_buyer_legal_entity_id_idx").on(table.buyerLegalEntityId),
    index("bid_lot_id_created_at_idx").on(table.lotId, table.createdAt),
    uniqueIndex("bid_one_winner_per_lot_uniq")
      .on(table.lotId)
      .where(sql`${table.isWinning} = true`),
  ],
);

export const bidRelations = relations(bid, ({ one }) => ({
  buyerLegalEntity: one(legalEntity, {
    fields: [bid.buyerLegalEntityId],
    references: [legalEntity.id],
  }),
}));
