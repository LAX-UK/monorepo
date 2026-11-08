"use client";

import { toMarketingWork } from "@/components/sections/home/home-hang/to-marketing-work";
import { hangMetaLine } from "@/lib/hang/hang-meta";
import type { SaleHangVM } from "@/lib/hang/sale-hang";
import { reportImageFallback } from "@/lib/observability/report-image-fallback";
import { MarketingHang } from "@auction/marketing-ui";

/** The hang that opens a sale's catalogue: the room first, then the lots. */
export function SaleroomHangSection({ hang }: { hang: SaleHangVM }) {
  return (
    <MarketingHang
      title={hang.title}
      meta={(mode) => hangMetaLine(hang.summary, mode)}
      works={hang.works.map(toMarketingWork)}
      figure={hang.figure}
      onImageFallback={reportImageFallback}
      rowLabel={`${hang.title}: works on the wall, scrolls sideways`}
    />
  );
}
