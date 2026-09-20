import type { CategorySummaryReadModel } from "../application/read-models/catalogue.read-model.js";

export type CategoryCatalogueRow = {
  slug: string;
  label: string;
  coverImageUrl: string | null;
  artworkCount: number;
};

export function toPublicCategorySummary(row: CategoryCatalogueRow): CategorySummaryReadModel {
  return {
    slug: row.slug,
    label: row.label,
    imageUrl: row.coverImageUrl,
    artworkCount: row.artworkCount,
  };
}
