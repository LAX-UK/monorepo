import {
  type ArtistRef,
  type NewArtworkRegisterEntry,
  type RegisterFieldValues,
  type ZohoChange,
  parseStockCode,
} from "@auction/artwork-register-contracts";
import { type CatalogueProduct, isDemoArtist } from "./catalogue-product.js";

/** Why a Product cannot become a register record, or is ignored. */
export type SkipReason =
  | "demo_artist"
  | "invalid_modified_time"
  | "missing_title"
  | "missing_stock_code"
  | "invalid_stock_code"
  | "missing_artist"
  | "missing_artist_code";

/** Something worth a person's attention that does not stop the Product coming in. */
export type CatalogueGap =
  | "missing_price"
  | "missing_medium"
  | "missing_dimensions"
  | "artist_code_differs_from_stock_code";

export type ProductAssessment = {
  productId: string;
  title: string | null;
  stockCode: string | null;
  modifiedAt: Date | null;
  /** Reasons the Product cannot be created. Empty when it can. */
  blockers: SkipReason[];
  gaps: CatalogueGap[];
  /** What Zoho says, as register fields. Only fields Zoho gave a usable value for are present. */
  change: ZohoChange | null;
  /** The register record this Product would become; null when anything blocks it. */
  newEntry: NewArtworkRegisterEntry | null;
};

function resolveArtist(
  product: CatalogueProduct,
  stockArtistCode: string | null,
): ArtistRef | null {
  if (!product.artist) return null;
  const code = stockArtistCode ?? product.artist.code1 ?? product.artist.code2;
  if (!code) return null;
  return { zohoArtistId: product.artist.id, name: product.artist.name, code };
}

/**
 * Turns a Zoho Product into what the register needs, with the reasons it cannot be created and
 * the gaps a person should know about. Pure: no reads, no writes.
 *
 * The artist part of the stock code is the artist's code in the register, since staff already read
 * codes that way; Zoho's own artist codes are only a fallback and a cross-check.
 */
export function assessProduct(product: CatalogueProduct): ProductAssessment {
  const blockers: SkipReason[] = [];
  const gaps: CatalogueGap[] = [];

  if (isDemoArtist(product.artist)) blockers.push("demo_artist");
  if (!product.modifiedAt) blockers.push("invalid_modified_time");
  if (!product.title) blockers.push("missing_title");

  const parts = product.stockCode ? parseStockCode(product.stockCode) : null;
  if (!product.stockCode) blockers.push("missing_stock_code");
  else if (!parts) blockers.push("invalid_stock_code");

  const artist = resolveArtist(product, parts?.artist ?? null);
  if (!product.artist) blockers.push("missing_artist");
  else if (!artist) blockers.push("missing_artist_code");

  if (!product.medium) gaps.push("missing_medium");
  if (!product.dimensions) gaps.push("missing_dimensions");
  if (product.unitPrice === null || product.unitPrice <= 0) gaps.push("missing_price");
  if (
    parts &&
    product.artist &&
    (product.artist.code1 || product.artist.code2) &&
    product.artist.code1 !== parts.artist &&
    product.artist.code2 !== parts.artist
  ) {
    gaps.push("artist_code_differs_from_stock_code");
  }

  const base = {
    productId: product.id,
    title: product.title,
    stockCode: product.stockCode,
    modifiedAt: product.modifiedAt,
    blockers,
    gaps,
  };
  const modifiedAt = product.modifiedAt;
  if (!modifiedAt) return { ...base, change: null, newEntry: null };

  const fields: Partial<RegisterFieldValues> = {
    medium: product.medium,
    dimensions: product.dimensions,
    year: product.year,
    catalogueStatus: product.status,
  };
  if (product.title) fields.title = product.title;
  if (artist) fields.artist = artist;
  if (product.stockCode && parts) {
    fields.stockCode = product.stockCode;
    fields.kind = parts.kind;
  }
  const change: ZohoChange = { zohoProductId: product.id, modifiedAt, fields };

  const { title, stockCode } = product;
  const newEntry: NewArtworkRegisterEntry | null =
    blockers.length === 0 && title && stockCode && parts && artist
      ? {
          zohoProductId: product.id,
          stockCode,
          kind: parts.kind,
          sourceOriginalId: null,
          title,
          artist,
          medium: product.medium,
          dimensions: product.dimensions,
          year: product.year,
          imageRefs: [],
          catalogueStatus: product.status,
          zohoModifiedAt: modifiedAt,
        }
      : null;

  return { ...base, change, newEntry };
}
