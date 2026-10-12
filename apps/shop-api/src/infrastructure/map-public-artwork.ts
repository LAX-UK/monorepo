import { formatArtworkDimensionsCm, publicEditionAvailability } from "@auction/shop-domain";
import type {
  ArtworkDetailReadModel,
  ArtworkImageReadModel,
  ArtworkSummaryReadModel,
} from "../application/read-models/catalogue.read-model.js";

export type ArtworkCatalogueRow = {
  slug: string;
  title: string;
  description: string | null;
  primaryImageUrl: string | null;
  images: ArtworkImageReadModel[];
  artistName: string;
  artistSlug: string;
  saleState: "for_sale" | "price_on_application" | "sold";
  dimensions: string | null;
  heightCm: number | null;
  widthCm: number | null;
  depthCm: number | null;
  medium: string | null;
  yearCreated: number | null;
  objectType:
    | "painting"
    | "work_on_paper"
    | "sculpture"
    | "photography"
    | "print"
    | "mixed_media"
    | null;
  rarity: "unique" | "limited_edition" | "open_edition" | null;
  hasCertificate: boolean;
  provenance: string | null;
  exhibitionHistory: string | null;
  salesChannel: "shop" | "art";
  eligibleForEditionAllocation: boolean;
  printPricePence: number | null;
  totalEditionCount: number;
  availableEditionCount: number;
};

export function parseDbNumeric(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dimensionsCmDisplay(row: ArtworkCatalogueRow): string | null {
  return (
    formatArtworkDimensionsCm({
      heightCm: row.heightCm,
      widthCm: row.widthCm,
      depthCm: row.depthCm,
    }) ?? row.dimensions
  );
}

function primaryImageUrl(row: ArtworkCatalogueRow): string | null {
  if (row.images.length > 0) {
    return row.images[0]?.url ?? row.primaryImageUrl;
  }
  return row.primaryImageUrl;
}

export function toPublicArtworkSummary(row: ArtworkCatalogueRow): ArtworkSummaryReadModel {
  return {
    slug: row.slug,
    title: row.title,
    artistName: row.artistName,
    artistSlug: row.artistSlug,
    imageUrl: primaryImageUrl(row),
    saleState: row.saleState,
    dimensions: row.dimensions,
    dimensionsCmDisplay: dimensionsCmDisplay(row),
    medium: row.medium,
    yearCreated: row.yearCreated,
    objectType: row.objectType,
    rarity: row.rarity,
    salesChannel: row.salesChannel,
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
    images: row.images,
    heightCm: row.heightCm,
    widthCm: row.widthCm,
    depthCm: row.depthCm,
    hasCertificate: row.hasCertificate,
    provenance: row.provenance,
    exhibitionHistory: row.exhibitionHistory,
  };
}
