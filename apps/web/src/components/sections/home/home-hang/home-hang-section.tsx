"use client";

import type { HomeHangVM } from "@/lib/hang/home-hang";
import { MarketingHang, type MarketingHangWork } from "@auction/marketing-ui";
import { HangLotLabel } from "./hang-lot-label";

const SCALE_NOTE = "hung at true relative scale";

function toMarketingWork(work: HomeHangVM["works"][number]): MarketingHangWork {
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

/**
 * The hang under the home hero: "In this sale" while a sale is live or upcoming, "Recently sold"
 * between sales. The meta line says whether the wall is to scale, so a wall of works with missing
 * sizes is honest about it.
 */
export function HomeHangSection({ hang }: { hang: HomeHangVM | null }) {
  if (!hang) return null;
  const { seeAll } = hang;
  return (
    <MarketingHang
      title={hang.title}
      meta={(mode) =>
        hang.scaleNote
          ? `${hang.summary} · ${mode === "scale" ? SCALE_NOTE : "not to scale"}`
          : hang.summary
      }
      works={hang.works.map(toMarketingWork)}
      seeAll={{
        href: seeAll.href,
        label: seeAll.label,
        tile: { title: seeAll.label, ...(seeAll.tileNote ? { note: seeAll.tileNote } : {}) },
      }}
      rowLabel={`${hang.title}: works on the wall, scrolls sideways`}
    />
  );
}
