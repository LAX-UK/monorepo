import {
  ARTWORK_OBJECT_TYPE_LABELS,
  ARTWORK_RARITY_LABELS,
  artworkCatalogueHref,
  emptyArtworkCatalogueState,
} from "@/lib/catalogue/artwork-catalogue-params";
import { isArtworkEnquiryAvailable } from "@/lib/presenters/artwork-commerce.presenter";
import type { PublicArtworkDetail } from "@auction/shop-contracts";

/** One fact with one or more value lines (dimensions show cm and inches on separate lines). */
export type ArtworkSpecRow = { label: string; lines: string[] };

export type ArtworkBreadcrumbItem = { label: string; href?: string };

type ArtworkDimensionFacts = Pick<
  PublicArtworkDetail,
  "heightCm" | "widthCm" | "depthCm" | "dimensionsCmDisplay" | "dimensions"
>;

const CM_PER_INCH = 2.54;

function oneDecimal(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** "120 × 90 cm" and "47.2 × 35.4 in" from structured centimetres; null when height or width is unknown. */
export function formatArtworkDimensions(
  artwork: Pick<PublicArtworkDetail, "heightCm" | "widthCm" | "depthCm">,
): { cm: string; inches: string } | null {
  const { heightCm, widthCm, depthCm } = artwork;
  if (heightCm == null || widthCm == null) return null;
  const parts = [heightCm, widthCm, ...(depthCm != null && depthCm > 0 ? [depthCm] : [])];
  return {
    cm: `${parts.map(oneDecimal).join(" × ")} cm`,
    inches: `${parts.map((cm) => oneDecimal(cm / CM_PER_INCH)).join(" × ")} in`,
  };
}

/** Structured sizes win; older records only carry a free-text dimensions string. */
function dimensionLines(artwork: ArtworkDimensionFacts): string[] {
  const derived = formatArtworkDimensions(artwork);
  if (derived) return [derived.cm, derived.inches];
  const text = artwork.dimensionsCmDisplay ?? artwork.dimensions;
  return text ? [text] : [];
}

/** Year, medium and dimensions in the info column (Figma 426:2581). */
export function buildArtworkKeySpecs(artwork: PublicArtworkDetail): ArtworkSpecRow[] {
  const rows: ArtworkSpecRow[] = [];
  if (artwork.yearCreated != null)
    rows.push({ label: "Year", lines: [String(artwork.yearCreated)] });
  if (artwork.medium) rows.push({ label: "Medium", lines: [artwork.medium] });
  const dimensions = dimensionLines(artwork);
  if (dimensions.length > 0) rows.push({ label: "Dimensions", lines: dimensions });
  return rows;
}

/** "Medium & dimensions" accordion: the physical facts plus object type and rarity. */
export function buildArtworkMediumSpecs(artwork: PublicArtworkDetail): ArtworkSpecRow[] {
  const rows: ArtworkSpecRow[] = [];
  if (artwork.objectType) {
    rows.push({ label: "Object type", lines: [ARTWORK_OBJECT_TYPE_LABELS[artwork.objectType]] });
  }
  if (artwork.rarity)
    rows.push({ label: "Rarity", lines: [ARTWORK_RARITY_LABELS[artwork.rarity]] });
  if (artwork.medium) rows.push({ label: "Medium", lines: [artwork.medium] });
  const dimensions = dimensionLines(artwork);
  if (dimensions.length > 0) rows.push({ label: "Dimensions", lines: dimensions });
  return rows;
}

/** Catalogue filtered to this work's object type; null when the type is unknown. */
export function artworkCategoryHref(
  artwork: Pick<PublicArtworkDetail, "objectType">,
): string | null {
  if (!artwork.objectType) return null;
  return artworkCatalogueHref(emptyArtworkCatalogueState(), {
    objectTypes: [artwork.objectType],
  });
}

/**
 * "Artworks / <object type> / <title>". Figma also draws a "Private Sales" level, which has
 * no data behind it, so it is left out.
 */
export function buildArtworkBreadcrumb(
  artwork: Pick<PublicArtworkDetail, "objectType" | "title">,
): ArtworkBreadcrumbItem[] {
  const items: ArtworkBreadcrumbItem[] = [{ label: "Artworks", href: "/artworks" }];
  const categoryHref = artworkCategoryHref(artwork);
  if (artwork.objectType && categoryHref) {
    items.push({ label: ARTWORK_OBJECT_TYPE_LABELS[artwork.objectType], href: categoryHref });
  }
  items.push({ label: artwork.title });
  return items;
}

export function artworkCertificateLine(
  artwork: Pick<PublicArtworkDetail, "hasCertificate">,
): string | null {
  return artwork.hasCertificate ? "Includes a certificate of authenticity" : null;
}

/** Reassurance under the price while the work can still be enquired about. */
export function artworkPriceNote(artwork: PublicArtworkDetail): string | null {
  return isArtworkEnquiryAvailable(artwork)
    ? "Contact us to discuss this work. All enquiries are handled with complete discretion."
    : null;
}
