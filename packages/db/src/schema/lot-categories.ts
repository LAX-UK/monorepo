import { index, integer, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { category } from "./categories.js";
import { lot } from "./lots.js";

export const lotCategories = pgTable(
  "lot_categories",
  {
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lot.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.lotId, table.categoryId] }),
    index("lot_categories_category_id_idx").on(table.categoryId),
    index("lot_categories_lot_id_sort_order_idx").on(table.lotId, table.sortOrder),
  ],
);
