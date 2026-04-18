import { index, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { category } from "./categories.js";
import { lot } from "./lots.js";

export const itemSubmissionStatusEnum = pgEnum("item_submission_status", [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "withdrawn",
  "converted",
]);

export const itemSubmission = pgTable(
  "item_submission",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sellerId: text("seller_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    medium: text("medium"),
    dimensions: text("dimensions"),
    images: text("images").array().notNull().default([]),
    askingPrice: numeric("asking_price", { precision: 18, scale: 2 }),
    reservePrice: numeric("reserve_price", { precision: 18, scale: 2 }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "restrict" }),
    submitterNotes: text("submitter_notes"),
    status: itemSubmissionStatusEnum("status").notNull().default("draft"),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { mode: "date", withTimezone: true }),
    reviewNotes: text("review_notes"),
    rejectionReason: text("rejection_reason"),
    convertedLotId: uuid("converted_lot_id").references(() => lot.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("item_submission_seller_id_idx").on(table.sellerId),
    index("item_submission_status_created_at_idx").on(table.status, table.createdAt),
    index("item_submission_converted_lot_id_idx").on(table.convertedLotId),
  ],
);
