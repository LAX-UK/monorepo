import type { PublicArtworkDetail } from "@auction/shop-contracts";
import { formatArtworkSize } from "@auction/shop-domain";

/** One fact in the "Details" list; sizes carry centimetres and inches on separate lines. */
export type ArtworkSpecRow = { label: string; lines: string[] };

type SizeFacts = Pick<
  PublicArtworkDetail,
  "heightCm" | "widthCm" | "depthCm" | "dimensionsCmDisplay" | "dimensions"
>;

/** Structured sizes win; older records only carry the size as catalogued text. */
export function artworkSizeLines(artwork: SizeFacts): string[] {
  const size = formatArtworkSize({
    heightCm: artwork.heightCm ?? null,
    widthCm: artwork.widthCm ?? null,
    depthCm: artwork.depthCm ?? null,
  });
  if (size) return [size.cm, size.inches];
  const text = artwork.dimensionsCmDisplay ?? artwork.dimensions;
  return text ? [text] : [];
}

/** "50 × 40 cm (19.7 × 15.7 in)" under the title, or the catalogued text; null when unknown. */
export function artworkSizeSummary(artwork: SizeFacts): string | null {
  const [first, second] = artworkSizeLines(artwork);
  if (!first) return null;
  return second ? `${first} (${second})` : first;
}

/**
 * The "Details" list, in a fixed order, from the fields the catalogue holds. A field with no
 * value is left out, so the list never shows an empty label.
 */
export function presentArtworkSpecs(artwork: PublicArtworkDetail): ArtworkSpecRow[] {
  const rows: ArtworkSpecRow[] = [];
  const { totalEditions } = artwork.availability;
  if (artwork.eligibleForEditionAllocation && totalEditions > 0) {
    rows.push({ label: "Edition", lines: [`Limited edition of ${totalEditions}`] });
  }
  if (artwork.medium) rows.push({ label: "Medium", lines: [artwork.medium] });
  if (artwork.printPaper) rows.push({ label: "Paper", lines: [artwork.printPaper] });
  const size = artworkSizeLines(artwork);
  if (size.length > 0) {
    rows.push({ label: artwork.printSize ? "Image size" : "Size", lines: size });
  }
  if (artwork.printSize) rows.push({ label: "Paper size", lines: [artwork.printSize] });
  if (artwork.yearCreated != null)
    rows.push({ label: "Year", lines: [String(artwork.yearCreated)] });
  if (artwork.hasCertificate) {
    rows.push({ label: "Certificate of authenticity", lines: ["Included"] });
  }
  return rows;
}
