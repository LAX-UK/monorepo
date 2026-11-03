import type { HomeHangWork } from "@/lib/hang/home-hang";
import type { MarketingHangWork } from "@auction/marketing-ui";
import { HangLotLabel } from "./hang-lot-label";

/** A hang work from the view model, with its live wall label. */
export function toMarketingWork(work: HomeHangWork): MarketingHangWork {
  const { photo } = work;
  return {
    id: work.lotId,
    href: work.href,
    imageSrc: photo.imageSrc,
    aspect: photo.aspect,
    longSideCm: photo.longSideCm,
    sourceWidthPx: photo.sourceWidthPx,
    sourceHeightPx: photo.sourceHeightPx,
    label: <HangLotLabel model={work.label} />,
  };
}
