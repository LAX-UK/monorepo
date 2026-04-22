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
    <div className="w-full max-w-[786px] overflow-hidden bg-[#0A0A0A]">
      <div className="min-h-[280px] w-full sm:min-h-[360px] lg:min-h-[420px]">
        <ArtworkImageStage
          title={lot.title}
          images={lot.images}
          imageAlts={lot.marketingDetails.imageAlts}
        />
      </div>
    </div>
  );
}
