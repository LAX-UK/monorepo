import { index, integer, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { category } from "./categories.js";
import { itemSubmission } from "./item-submissions.js";

export const submissionCategories = pgTable(
  "submission_categories",
  {
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => itemSubmission.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.submissionId, table.categoryId] }),
    index("submission_categories_category_id_idx").on(table.categoryId),
    index("submission_categories_submission_id_sort_order_idx").on(
      table.submissionId,
      table.sortOrder,
    ),
  ],
);
