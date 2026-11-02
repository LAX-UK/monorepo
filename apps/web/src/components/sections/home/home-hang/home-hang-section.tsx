"use client";

import { hangMetaLine } from "@/lib/hang/hang-meta";
import type { HomeHangVM } from "@/lib/hang/home-hang";
import { MarketingHang } from "@auction/marketing-ui";
import { toMarketingWork } from "./to-marketing-work";

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
      meta={(mode) => (hang.scaleNote ? hangMetaLine(hang.summary, mode) : hang.summary)}
      works={hang.works.map(toMarketingWork)}
      seeAll={{
        href: seeAll.href,
        label: seeAll.label,
        tile: { title: seeAll.label, ...(seeAll.tileNote ? { note: seeAll.tileNote } : {}) },
      }}
      headingSize="section"
      rowLabel={`${hang.title}: works on the wall, scrolls sideways`}
    />
  );
}
