"use client";

import type { HomeHangVm } from "@/lib/home/home-hang";
import { MarketingHang, MarketingHangLabel } from "@auction/marketing-ui";

/**
 * "New editions" hung on their sheets under the cover. The meta line says whether the wall is to
 * scale, so a wall with a missing size is honest about it.
 */
export function HomeHangSection({ hang }: { hang: HomeHangVm }) {
  return (
    <MarketingHang
      title={hang.title}
      meta={(mode) =>
        `${hang.countLabel} · ${mode === "scale" ? "prints on their sheets at true relative scale" : "Not to scale"}`
      }
      works={hang.works.map((work) => ({
        id: work.slug,
        href: work.href,
        imageSrc: work.imageSrc,
        aspect: work.aspect,
        longSideCm: work.longSideCm,
        sourceWidthPx: work.sourceWidthPx,
        sourceHeightPx: work.sourceHeightPx,
        sheetInset: work.sheetInset,
        label: (
          <MarketingHangLabel
            eyebrow={work.label.artist}
            title={work.label.title}
            price={work.label.price ? { value: work.label.price } : undefined}
            notes={work.label.note ? [work.label.note] : undefined}
          />
        ),
      }))}
      seeAll={{
        href: hang.seeAll.href,
        label: hang.seeAll.label,
        tile: { title: hang.seeAll.label, note: hang.seeAll.tileNote },
      }}
      headingSize="section"
      rowLabel="New editions: prints on the wall, scrolls sideways"
    />
  );
}
