import { index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { category } from "./categories.js";

export const userCategoryInterest = pgTable(
  "user_category_interest",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.categoryId] }),
    index("user_category_interest_category_id_idx").on(table.categoryId),
    index("user_category_interest_user_sort_idx").on(table.userId, table.sortOrder),
  ],
);
