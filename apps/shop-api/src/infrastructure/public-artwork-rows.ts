import type { Database } from "@auction/db";
import { shopArtist, shopArtwork, shopEdition, shopParty } from "@auction/db/schema";
import { count, inArray } from "drizzle-orm";
import type {
  ArtworkImageReadModel,
  ArtworkSummaryReadModel,
} from "../application/read-models/catalogue.read-model.js";
import {
  type ArtworkCatalogueRow,
  parseDbNumeric,
  toPublicArtworkSummary,
} from "./map-public-artwork.js";
import { sellableEditionCountSql } from "./shop-edition-availability.js";

type EditionCounts = { total: number; available: number };

/** Turns a stored image value (media key, root-relative seed path or absolute URL) into a public URL. */
export type ResolveArtworkMediaUrl = (value: string | null | undefined) => string | null;

/** Columns every public artwork read selects; callers join `shopArtist` and `shopParty`. */
export const publicArtworkColumns = {
  artworkId: shopArtwork.id,
  slug: shopArtwork.slug,
  title: shopArtwork.title,
  description: shopArtwork.description,
  primaryImageUrl: shopArtwork.primaryImageUrl,
  saleState: shopArtwork.saleState,
  dimensions: shopArtwork.dimensions,
  heightCm: shopArtwork.heightCm,
  widthCm: shopArtwork.widthCm,
  depthCm: shopArtwork.depthCm,
  medium: shopArtwork.medium,
  yearCreated: shopArtwork.yearCreated,
  objectType: shopArtwork.objectType,
  rarity: shopArtwork.rarity,
  hasCertificate: shopArtwork.hasCertificate,
  provenance: shopArtwork.provenance,
  exhibitionHistory: shopArtwork.exhibitionHistory,
  seoTitle: shopArtwork.seoTitle,
  seoDescription: shopArtwork.seoDescription,
  updatedAt: shopArtwork.updatedAt,
  salesChannel: shopArtwork.salesChannel,
  artistName: shopParty.displayName,
  artistSlug: shopArtist.slug,
  eligibleForEditionAllocation: shopArtwork.eligibleForEditionAllocation,
  printPricePence: shopArtwork.printPricePence,
  createdAt: shopArtwork.createdAt,
};

export type SelectedArtworkRow = {
  artworkId: string;
  slug: string;
  title: string;
  description: string | null;
  primaryImageUrl: string | null;
  saleState: "for_sale" | "price_on_application" | "sold";
  dimensions: string | null;
  heightCm: string | null;
  widthCm: string | null;
  depthCm: string | null;
  medium: string | null;
  yearCreated: number | null;
  objectType: ArtworkCatalogueRow["objectType"];
  rarity: ArtworkCatalogueRow["rarity"];
  hasCertificate: boolean;
  provenance: string | null;
  exhibitionHistory: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: Date;
  salesChannel: "shop" | "art";
  artistName: string;
  artistSlug: string;
  eligibleForEditionAllocation: boolean;
  printPricePence: number | null;
  createdAt: Date;
  placementPosition?: number;
};

export async function editionCountsByArtworkId(
  db: Database,
  artworkIds: string[],
): Promise<Map<string, EditionCounts>> {
  if (artworkIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({
      artworkId: shopEdition.artworkId,
      total: count(),
      available: sellableEditionCountSql,
    })
    .from(shopEdition)
    .where(inArray(shopEdition.artworkId, artworkIds))
    .groupBy(shopEdition.artworkId);
  return new Map(
    rows.map((row) => [
      row.artworkId,
      { total: Number(row.total), available: Number(row.available) },
    ]),
  );
}

export function toArtworkCatalogueRow(
  row: SelectedArtworkRow,
  editionCounts: Map<string, EditionCounts>,
  resolveMediaUrl: ResolveArtworkMediaUrl,
  images: ArtworkImageReadModel[] = [],
): ArtworkCatalogueRow {
  const counts = editionCounts.get(row.artworkId) ?? { total: 0, available: 0 };
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    primaryImageUrl: resolveMediaUrl(row.primaryImageUrl),
    images,
    artistName: row.artistName,
    artistSlug: row.artistSlug,
    saleState: row.saleState,
    dimensions: row.dimensions,
    heightCm: parseDbNumeric(row.heightCm),
    widthCm: parseDbNumeric(row.widthCm),
    depthCm: parseDbNumeric(row.depthCm),
    medium: row.medium,
    yearCreated: row.yearCreated,
    objectType: row.objectType,
    rarity: row.rarity,
    hasCertificate: row.hasCertificate,
    provenance: row.provenance,
    exhibitionHistory: row.exhibitionHistory,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    updatedAt: row.updatedAt,
    listedAt: row.createdAt,
    salesChannel: row.salesChannel,
    eligibleForEditionAllocation: row.eligibleForEditionAllocation,
    printPricePence: row.printPricePence,
    totalEditionCount: counts.total,
    availableEditionCount: counts.available,
  };
}

/** Edition availability is loaded in one batch for the whole page of rows. */
export async function toPublicArtworkSummaries(
  db: Database,
  rows: SelectedArtworkRow[],
  resolveMediaUrl: ResolveArtworkMediaUrl,
): Promise<ArtworkSummaryReadModel[]> {
  const editionCounts = await editionCountsByArtworkId(
    db,
    rows.map((row) => row.artworkId),
  );
  return rows.map((row) =>
    toPublicArtworkSummary(toArtworkCatalogueRow(row, editionCounts, resolveMediaUrl)),
  );
}
