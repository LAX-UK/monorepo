import { ArtworkImageStage } from "@/components/sections/artwork/artwork-image-stage";
import type { Lot } from "@auction/types";

type Props = {
  lot: Pick<Lot, "title" | "images" | "marketingDetails">;
};

/**
 * Figma: ~786×502 hero; not sticky. Wraps the existing lightbox + thumbs stack.
 */
export function LotMediaBlock({ lot }: Props) {
  return (
    <div className="relative w-full max-w-[786px] aspect-[786/502] overflow-hidden bg-[#0A0A0A]">
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
