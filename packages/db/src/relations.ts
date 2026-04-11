import { relations } from "drizzle-orm";
import { auction } from "./schema/auctions.js";
import { user } from "./schema/auth.js";
import { bid } from "./schema/bids.js";
import { category } from "./schema/categories.js";

export const auctionRelations = relations(auction, ({ one, many }) => ({
  seller: one(user, {
    fields: [auction.sellerId],
    references: [user.id],
  }),
  winner: one(user, {
    fields: [auction.winnerId],
    references: [user.id],
  }),
  category: one(category, {
    fields: [auction.categoryId],
    references: [category.id],
  }),
  bids: many(bid),
}));

export const bidRelations = relations(bid, ({ one }) => ({
  auction: one(auction, {
    fields: [bid.auctionId],
    references: [auction.id],
  }),
  bidder: one(user, {
    fields: [bid.bidderId],
    references: [user.id],
  }),
}));

export const categoryRelations = relations(category, ({ one, many }) => ({
  parent: one(category, {
    fields: [category.parentId],
    references: [category.id],
    relationName: "category_parent",
  }),
  children: many(category, { relationName: "category_parent" }),
  auctions: many(auction),
}));
