import type { PressCoverageVM } from "@/components/sections/saleroom/view-models";
import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import type { PressArchiveEntry, PressDayMediaSaleSummary } from "@auction/types";

export type PressArchiveEntryVM = PressCoverageVM & {
  saleId: string;
  saleTitle: string;
  saleHref: string;
  salePressHref: string;
};

export type PressDayMediaSaleVM = {
  id: string;
  title: string;
  href: string;
  galleryHref: string;
  coverImageUrl: string | null;
  dayImageCount: number;
  endDateLabel: string | null;
};

export function mapPressDayMediaSaleToVM(
  sale: PressDayMediaSaleSummary,
  salePathFn: (sale: Pick<PressDayMediaSaleSummary, "id" | "title">) => string,
): PressDayMediaSaleVM {
  const href = salePathFn(sale);
  let endDateLabel: string | null = null;
  if (sale.endTime) {
    endDateLabel = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(sale.endTime);
  }
  const coverImageUrl = sale.coverImages[0] ? resolveMediaSrc(sale.coverImages[0]) : null;
  return {
    id: sale.id,
    title: sale.title,
    href,
    galleryHref: `${href}#gallery`,
    coverImageUrl,
    dayImageCount: sale.dayImageCount,
    endDateLabel,
  };
}

export function mapPressRefToVM(ref: {
  url: string;
  headline: string;
  outletName: string;
  publishedAt?: string;
  excerpt?: string;
  mentionType?: PressCoverageVM["mentionType"];
}): PressCoverageVM {
  let domain = "";
  try {
    domain = new URL(ref.url).hostname.replace(/^www\./, "");
  } catch {
    domain = ref.outletName.toLowerCase().replace(/\s+/g, "");
  }
  let dateLabel: string | null = null;
  if (ref.publishedAt) {
    try {
      dateLabel = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(`${ref.publishedAt}T12:00:00Z`));
    } catch {
      dateLabel = ref.publishedAt;
    }
  }
  return {
    url: ref.url,
    headline: ref.headline,
    outletName: ref.outletName,
    domain,
    dateLabel,
    publishedAt: ref.publishedAt ?? null,
    excerpt: ref.excerpt ?? null,
    mentionType: ref.mentionType ?? null,
  };
}

export function mapPressArchiveEntryToVM(
  entry: PressArchiveEntry,
  salePath: (sale: Pick<PressArchiveEntry["sale"], "id" | "title">) => string,
): PressArchiveEntryVM {
  const base = mapPressRefToVM(entry.item);
  const saleHref = salePath(entry.sale);
  return {
    ...base,
    saleId: entry.sale.id,
    saleTitle: entry.sale.title,
    saleHref,
    salePressHref: `${saleHref}#press`,
  };
}
