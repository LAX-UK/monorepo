"use client";

import { MarketingFilterSheet } from "@/components/marketing/marketing-filter-sheet";
import { MarketingFilterTrigger } from "@/components/marketing/marketing-filter-trigger";
import { ArchiveFilterSheetBody } from "@/components/sections/archive/archive-filter-sheet-body";
import {
  type ArchivePageQuery,
  archiveClearFiltersHref,
  countActiveArchiveFilters,
} from "@/lib/archive/build-archive-params";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type Category = { id: string; name: string };

type Props = {
  query: Pick<ArchivePageQuery, "endYear" | "categoryId" | "sortMode">;
  categories: Category[];
  resultCountLabel: string;
  layoutView: CatalogLayoutView;
};

/** Mobile filter sheet for the past-auctions archive on `/archive`. */
export function ArchiveFilterSheet({ query, categories, resultCountLabel, layoutView }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const activeCount = countActiveArchiveFilters(query);
  const close = useCallback(() => setOpen(false), []);

  return (
    <MarketingFilterSheet
      open={open}
      onOpenChange={setOpen}
      title="Filters"
      trigger={<MarketingFilterTrigger activeCount={activeCount} />}
      applyLabel={resultCountLabel}
      onApply={close}
      onReset={() => {
        router.push(archiveClearFiltersHref(layoutView === "list" ? "list" : undefined));
        close();
      }}
    >
      <ArchiveFilterSheetBody categories={categories} onSelect={close} />
    </MarketingFilterSheet>
  );
}
