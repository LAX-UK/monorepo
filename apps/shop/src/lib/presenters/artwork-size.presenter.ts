import type { PublicArtworkDetail } from "@auction/shop-contracts";
import { formatArtworkSize } from "@auction/shop-domain";

type SizeFacts = Pick<
  PublicArtworkDetail,
  "heightCm" | "widthCm" | "depthCm" | "dimensionsCmDisplay" | "dimensions"
>;

/**
 * "60 × 45 cm (23.6 × 17.7 in)": structured sizes win; older records only carry the size as
 * catalogued text, which is shown as it is. Null without any size.
 */
export function artworkSizeText(artwork: SizeFacts): string | null {
  const size = formatArtworkSize({
    heightCm: artwork.heightCm ?? null,
    widthCm: artwork.widthCm ?? null,
    depthCm: artwork.depthCm ?? null,
  });
  if (size) return `${size.cm} (${size.inches})`;
  return artwork.dimensionsCmDisplay ?? artwork.dimensions ?? null;
}
