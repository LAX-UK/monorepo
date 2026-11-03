import { hangMetaLine } from "@/lib/hang/hang-meta";
import type { HomeHangVM } from "@/lib/hang/home-hang";
import type { MarketingHangProps } from "@auction/marketing-ui";
import { toMarketingWork } from "./to-marketing-work";

/** The wall's meta line, seeAll link and works for a hang, shared by every place that hangs one. */
export function toHangProps(
  hang: HomeHangVM,
): Pick<MarketingHangProps, "meta" | "works" | "seeAll" | "rowLabel"> {
  const { seeAll } = hang;
  return {
    meta: (mode) => (hang.scaleNote ? hangMetaLine(hang.summary, mode) : hang.summary),
    works: hang.works.map(toMarketingWork),
    seeAll: {
      href: seeAll.href,
      label: seeAll.label,
      tile: { title: seeAll.label, ...(seeAll.tileNote ? { note: seeAll.tileNote } : {}) },
    },
    rowLabel: `${hang.title}: works on the wall, scrolls sideways`,
  };
}
