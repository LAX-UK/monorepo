import { ArtworkImageStage } from "@/components/sections/artwork/artwork-image-stage";
import type { Lot } from "@auction/types";

type Props = {
  lot: Pick<Lot, "title" | "images" | "marketingDetails" | "dimensions">;
};

/** e.g. "120 x 90 cm" or "800×600" → width/height for aspect-ratio */
function parseDimensionsAspect(
  dimensions: string | null | undefined,
): { w: number; h: number } | null {
  if (!dimensions) return null;
  const m = dimensions.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { w, h };
}

/** Figma: ~786×502 hero; not sticky. Wraps the lightbox + thumbs stack.
 * Uses catalog `dimensions` for aspect when two numbers are present; else Figma ratio.
 */
export function LotMediaBlock({ lot }: Props) {
  const custom = parseDimensionsAspect(lot.dimensions);
  const aspectStyle = custom
    ? ({ aspectRatio: `${custom.w} / ${custom.h}` } as const)
    : ({ aspectRatio: "786 / 502" } as const);

  return (
    <div
      className="relative w-full max-w-[786px] overflow-hidden bg-surface-container-lowest shadow-sm lg:max-h-full"
      style={aspectStyle}
    >
      <div className="absolute inset-0 min-h-0">
        <ArtworkImageStage
          title={lot.title}
          images={lot.images}
          imageAlts={lot.marketingDetails.imageAlts}
        />
      </div>
    </div>
  );
}
