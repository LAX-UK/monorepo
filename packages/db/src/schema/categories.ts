import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

export const category = pgTable(
  "category",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    archived: boolean("archived").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    parentId: uuid("parent_id").references((): AnyPgColumn => category.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("category_archived_idx").on(table.archived),
    index("category_parent_id_idx").on(table.parentId),
    index("category_sort_order_idx").on(table.sortOrder),
    index("category_slug_idx").on(table.slug),
  ],
);
