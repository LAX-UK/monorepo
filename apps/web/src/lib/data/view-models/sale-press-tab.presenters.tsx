import { PressCoverageCardMedia } from "@/components/sections/press/press-coverage-card-media";
import type { SalePressRef } from "@auction/types";

export function buildSalePressCardImage(item: SalePressRef) {
  return (
    <PressCoverageCardMedia
      layout="fill"
      imageUrl={item.imageUrl ?? null}
      mentionType={item.mentionType ?? null}
      outletName={item.outletName}
      headline={item.headline}
    />
  );
}
