import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";

export const category = pgTable(
  "category",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    parentId: uuid("parent_id"),
  },
  (table) => [
    index("category_parent_id_idx").on(table.parentId),
    index("category_slug_idx").on(table.slug),
  ],
);
