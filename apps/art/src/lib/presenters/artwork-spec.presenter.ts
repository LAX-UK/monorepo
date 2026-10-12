import type { PublicArtworkDetail } from "@auction/shop-contracts";

export type ArtworkSpecRow = { label: string; value: string };

export type ArtworkSpecGroups = {
  /** Object type, rarity, year, certificate. */
  details: ArtworkSpecRow[];
  /** Medium plus dimensions in centimetres and inches. */
  mediumAndDimensions: ArtworkSpecRow[];
};

const OBJECT_TYPE_LABELS: Record<NonNullable<PublicArtworkDetail["objectType"]>, string> = {
  painting: "Painting",
  work_on_paper: "Work on paper",
  sculpture: "Sculpture",
  photography: "Photography",
  print: "Print",
  mixed_media: "Mixed media",
};

const RARITY_LABELS: Record<NonNullable<PublicArtworkDetail["rarity"]>, string> = {
  unique: "Unique",
  limited_edition: "Limited edition",
  open_edition: "Open edition",
};

const CM_PER_INCH = 2.54;

function formatInches(cm: number): string {
  return String(Math.round((cm / CM_PER_INCH) * 10) / 10);
}

/** "15.7 × 19.7 in" from structured centimetres; null when height or width is unknown. */
export function formatArtworkDimensionsInches(
  artwork: Pick<PublicArtworkDetail, "heightCm" | "widthCm" | "depthCm">,
): string | null {
  const { heightCm, widthCm, depthCm } = artwork;
  if (heightCm == null || widthCm == null) return null;
  const parts = [heightCm, widthCm, ...(depthCm != null && depthCm > 0 ? [depthCm] : [])];
  return `${parts.map(formatInches).join(" × ")} in`;
}

export function buildArtworkSpecGroups(artwork: PublicArtworkDetail): ArtworkSpecGroups {
  const details: ArtworkSpecRow[] = [];
  if (artwork.objectType) {
    details.push({ label: "Object type", value: OBJECT_TYPE_LABELS[artwork.objectType] });
  }
  if (artwork.rarity) details.push({ label: "Rarity", value: RARITY_LABELS[artwork.rarity] });
  if (artwork.yearCreated != null) {
    details.push({ label: "Year", value: String(artwork.yearCreated) });
  }
  if (artwork.hasCertificate) details.push({ label: "Certificate", value: "Included" });

  const mediumAndDimensions: ArtworkSpecRow[] = [];
  if (artwork.medium) mediumAndDimensions.push({ label: "Medium", value: artwork.medium });
  const cm = artwork.dimensionsCmDisplay ?? artwork.dimensions;
  if (cm) mediumAndDimensions.push({ label: "Dimensions", value: cm });
  const inches = artwork.dimensionsCmDisplay ? formatArtworkDimensionsInches(artwork) : null;
  if (inches) mediumAndDimensions.push({ label: "Dimensions (in)", value: inches });

  return { details, mediumAndDimensions };
}

/** Line under the price when the work ships with a certificate of authenticity. */
export function artworkCertificateLine(artwork: PublicArtworkDetail): string | null {
  return artwork.hasCertificate ? "Includes a certificate of authenticity" : null;
}
