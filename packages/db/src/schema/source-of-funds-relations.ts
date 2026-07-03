import { relations } from "drizzle-orm";
import { user } from "./auth.js";
import { sourceOfFundsDocument } from "./source-of-funds-documents.js";
import { sourceOfFunds } from "./source-of-funds.js";

export const sourceOfFundsRelations = relations(sourceOfFunds, ({ one, many }) => ({
  user: one(user, {
    fields: [sourceOfFunds.userId],
    references: [user.id],
  }),
  reviewedBy: one(user, {
    fields: [sourceOfFunds.reviewedByUserId],
    references: [user.id],
  }),
  triagedBy: one(user, {
    fields: [sourceOfFunds.triagedByUserId],
    references: [user.id],
  }),
  documentsRequestedBy: one(user, {
    fields: [sourceOfFunds.documentsRequestedByUserId],
    references: [user.id],
  }),
  documents: many(sourceOfFundsDocument),
}));
