"use client";

import { MarketingFilterSheet } from "@/components/marketing/marketing-filter-sheet";
import { MarketingFilterTrigger } from "@/components/marketing/marketing-filter-trigger";
import { SaleroomCatalogStatusChips } from "@/components/sections/saleroom/saleroom-catalog-status-chips";
import {
  buildSaleroomClearStatusHref,
  countActiveSaleroomStatusFilters,
  parseSaleroomCatalogStatus,
} from "@/lib/marketing/saleroom-catalog-status";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

export type SaleroomCatalogFilterSheetProps = {
  basePath: string;
  resultCountLabel: string;
};

/** Mobile filter sheet for saleroom lot status on `/sales/[slug]/[id]`. */
export function SaleroomCatalogFilterSheet({
  basePath,
  resultCountLabel,
}: SaleroomCatalogFilterSheetProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const searchParams = new URLSearchParams(params?.toString() ?? "");
  const status = parseSaleroomCatalogStatus(searchParams.get("status"));
  const activeCount = countActiveSaleroomStatusFilters(status);
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
        router.push(buildSaleroomClearStatusHref(basePath, searchParams));
        close();
      }}
    >
      <div>
        <p className="mb-3 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Lot status
        </p>
        <SaleroomCatalogStatusChips basePath={basePath} layout="list" onSelect={close} />
      </div>
    </MarketingFilterSheet>
  );
}
