import { relations } from "drizzle-orm";
import { user } from "./schema/auth.js";
import { bid } from "./schema/bids.js";
import { category } from "./schema/categories.js";
import { itemSubmission } from "./schema/item-submissions.js";
import { lot } from "./schema/lots.js";
import { sale } from "./schema/sales.js";

export const saleRelations = relations(sale, ({ one, many }) => ({
  creator: one(user, {
    fields: [sale.createdBy],
    references: [user.id],
  }),
  themeCategory: one(category, {
    fields: [sale.categoryId],
    references: [category.id],
  }),
  lots: many(lot),
}));

export const lotRelations = relations(lot, ({ one, many }) => ({
  sale: one(sale, {
    fields: [lot.saleId],
    references: [sale.id],
  }),
  seller: one(user, {
    fields: [lot.sellerId],
    references: [user.id],
  }),
  winner: one(user, {
    fields: [lot.winnerId],
    references: [user.id],
  }),
  category: one(category, {
    fields: [lot.categoryId],
    references: [category.id],
  }),
  bids: many(bid),
}));

export const bidRelations = relations(bid, ({ one }) => ({
  lot: one(lot, {
    fields: [bid.lotId],
    references: [lot.id],
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
  lots: many(lot),
  themedSales: many(sale),
  submissions: many(itemSubmission),
}));

export const itemSubmissionRelations = relations(itemSubmission, ({ one }) => ({
  seller: one(user, {
    fields: [itemSubmission.sellerId],
    references: [user.id],
    relationName: "submission_seller",
  }),
  reviewer: one(user, {
    fields: [itemSubmission.reviewedBy],
    references: [user.id],
    relationName: "submission_reviewer",
  }),
  category: one(category, {
    fields: [itemSubmission.categoryId],
    references: [category.id],
  }),
  convertedLot: one(lot, {
    fields: [itemSubmission.convertedLotId],
    references: [lot.id],
  }),
}));
