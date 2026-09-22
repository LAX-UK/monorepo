import { publicEditionAvailability } from "@auction/shop-domain";
import type {
  ArtworkDetailReadModel,
  ArtworkSummaryReadModel,
} from "../application/read-models/catalogue.read-model.js";

export type ArtworkCatalogueRow = {
  slug: string;
  title: string;
  description: string | null;
  primaryImageUrl: string | null;
  artistName: string;
  saleState: "for_sale" | "price_on_application" | "sold";
  dimensions: string | null;
  yearCreated: number | null;
  eligibleForEditionAllocation: boolean;
  printPricePence: number | null;
  totalEditionCount: number;
  availableEditionCount: number;
};

export function toPublicArtworkSummary(row: ArtworkCatalogueRow): ArtworkSummaryReadModel {
  return {
    slug: row.slug,
    title: row.title,
    artistName: row.artistName,
    imageUrl: row.primaryImageUrl,
    saleState: row.saleState,
    dimensions: row.dimensions,
    yearCreated: row.yearCreated,
    eligibleForEditionAllocation: row.eligibleForEditionAllocation,
    printPricePence: row.printPricePence,
    availability: publicEditionAvailability({
      eligibleForEditionAllocation: row.eligibleForEditionAllocation,
      totalEditionCount: row.totalEditionCount,
      availableEditionCount: row.availableEditionCount,
    }),
  };
}

export function toPublicArtworkDetail(row: ArtworkCatalogueRow): ArtworkDetailReadModel {
  return {
    ...toPublicArtworkSummary(row),
    description: row.description,
  };
}
