import type { PublicArtworkDetail } from "@auction/shop-contracts";

export type ArtworkSpecRow = { label: string; value: string };

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

export function buildArtworkSpecRows(artwork: PublicArtworkDetail): ArtworkSpecRow[] {
  const rows: ArtworkSpecRow[] = [];
  if (artwork.dimensionsCmDisplay ?? artwork.dimensions) {
    rows.push({
      label: "Dimensions",
      value: artwork.dimensionsCmDisplay ?? artwork.dimensions ?? "",
    });
  }
  if (artwork.medium) rows.push({ label: "Medium", value: artwork.medium });
  if (artwork.yearCreated != null) {
    rows.push({ label: "Year", value: String(artwork.yearCreated) });
  }
  if (artwork.objectType) {
    rows.push({ label: "Object type", value: OBJECT_TYPE_LABELS[artwork.objectType] });
  }
  if (artwork.rarity) rows.push({ label: "Rarity", value: RARITY_LABELS[artwork.rarity] });
  if (artwork.hasCertificate) rows.push({ label: "Certificate", value: "Included" });
  return rows;
}
