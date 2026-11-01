import { isPublicLotStatus } from "@/lib/catalog/public-catalog-visibility";
import { longSideCmFromDimensions } from "@/lib/hang/dimensions";
import type { MarketingHangWork } from "@auction/marketing-ui";
import { resolveHangLongSide } from "@auction/marketing-ui";
import type { Lot } from "@auction/types";

/** Shape used when a photograph's size is not stored: a portrait, drawn in salon mode only. */
const FALLBACK_ASPECT = 0.8;

export type HangLotPhoto = Pick<
  MarketingHangWork,
  "imageSrc" | "aspect" | "longSideCm" | "sourceWidthPx" | "sourceHeightPx"
> & {
  /** The photograph shows a frame, but staff gave no framed size. */
  shownFramed: boolean;
};

function positive(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** The long side of the framed work, from whichever of its width and height staff entered. */
function framedLongSideCm(lot: Pick<Lot, "framedWidthCm" | "framedHeightCm">): number | null {
  const sides = [positive(lot.framedWidthCm), positive(lot.framedHeightCm)].filter(
    (side): side is number => side !== null,
  );
  return sides.length === 0 ? null : Math.max(...sides);
}

type HangLotSource = Pick<
  Lot,
  | "images"
  | "imageAssets"
  | "dimensions"
  | "photoIncludesFrame"
  | "framedWidthCm"
  | "framedHeightCm"
  | "status"
>;

/**
 * What the hang needs to draw a lot: its first photograph, the picture's shape and the work's
 * real size. `null` when the lot has no photograph or is not shown to the public (withdrawn lots
 * never appear). A lot whose picture size is unknown gets no real size, so the wall goes to
 * salon mode instead of drawing a wrong shape to scale.
 */
export function hangLotPhoto(lot: HangLotSource): HangLotPhoto | null {
  if (!isPublicLotStatus(lot.status)) return null;
  const imageSrc = lot.images[0];
  if (!imageSrc) return null;

  const asset = lot.imageAssets?.[0];
  const width = positive(asset?.width);
  const height = positive(asset?.height);
  const shapeKnown = width !== null && height !== null;

  const size = resolveHangLongSide(longSideCmFromDimensions(lot.dimensions), {
    photoIncludesFrame: lot.photoIncludesFrame === true,
    framedLongSideCm: framedLongSideCm(lot),
  });

  return {
    imageSrc,
    aspect: shapeKnown ? width / height : FALLBACK_ASPECT,
    longSideCm: shapeKnown ? size.longSideCm : null,
    sourceWidthPx: width,
    sourceHeightPx: height,
    shownFramed: size.shownFramed,
  };
}
