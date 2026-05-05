import { relations } from "drizzle-orm";
import { user } from "./schema/auth.js";
import { bid } from "./schema/bids.js";
import { category } from "./schema/categories.js";
import { itemSubmission } from "./schema/item-submissions.js";
import { lotCategories } from "./schema/lot-categories.js";
import { lot } from "./schema/lots.js";
import { saleCategories } from "./schema/sale-categories.js";
import { sale } from "./schema/sales.js";
import { submissionCategories } from "./schema/submission-categories.js";

export const saleRelations = relations(sale, ({ one, many }) => ({
  creator: one(user, {
    fields: [sale.createdBy],
    references: [user.id],
  }),
  categories: many(saleCategories),
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
  categories: many(lotCategories),
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
  lots: many(lotCategories),
  themedSales: many(saleCategories),
  submissions: many(submissionCategories),
}));

export const itemSubmissionRelations = relations(itemSubmission, ({ one, many }) => ({
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
  categories: many(submissionCategories),
  convertedLot: one(lot, {
    fields: [itemSubmission.convertedLotId],
    references: [lot.id],
  }),
}));

export const lotCategoryRelations = relations(lotCategories, ({ one }) => ({
  lot: one(lot, {
    fields: [lotCategories.lotId],
    references: [lot.id],
  }),
  category: one(category, {
    fields: [lotCategories.categoryId],
    references: [category.id],
  }),
}));

export const saleCategoryRelations = relations(saleCategories, ({ one }) => ({
  sale: one(sale, {
    fields: [saleCategories.saleId],
    references: [sale.id],
  }),
  category: one(category, {
    fields: [saleCategories.categoryId],
    references: [category.id],
  }),
}));

export const submissionCategoryRelations = relations(submissionCategories, ({ one }) => ({
  submission: one(itemSubmission, {
    fields: [submissionCategories.submissionId],
    references: [itemSubmission.id],
  }),
  category: one(category, {
    fields: [submissionCategories.categoryId],
    references: [category.id],
  }),
}));
