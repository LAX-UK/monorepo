import { relations } from "drizzle-orm";
import { index, integer, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { artistProfile } from "./artist-profiles.js";
import { category } from "./categories.js";

/** Links a creator/maker profile to one or more collecting categories
 * (departments). Mirrors {@link lotCategories} so creators share the single
 * `category` taxonomy used by lots. */
export const artistCategories = pgTable(
  "artist_categories",
  {
    artistProfileId: uuid("artist_profile_id")
      .notNull()
      .references(() => artistProfile.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.artistProfileId, table.categoryId] }),
    index("artist_categories_category_id_idx").on(table.categoryId),
    index("artist_categories_profile_sort_order_idx").on(table.artistProfileId, table.sortOrder),
  ],
);

export const artistCategoryRelations = relations(artistCategories, ({ one }) => ({
  artistProfile: one(artistProfile, {
    fields: [artistCategories.artistProfileId],
    references: [artistProfile.id],
  }),
  category: one(category, {
    fields: [artistCategories.categoryId],
    references: [category.id],
  }),
}));
