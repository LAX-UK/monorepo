import { index, integer, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { category } from "./categories.js";
import { sale } from "./sales.js";

export const saleCategories = pgTable(
  "sale_categories",
  {
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sale.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.saleId, table.categoryId] }),
    index("sale_categories_category_id_idx").on(table.categoryId),
    index("sale_categories_sale_id_sort_order_idx").on(table.saleId, table.sortOrder),
  ],
);
