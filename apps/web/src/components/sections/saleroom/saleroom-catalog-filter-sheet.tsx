"use client";

import { MarketingFilterSheet } from "@/components/marketing/marketing-filter-sheet";
import { MarketingFilterTrigger } from "@/components/marketing/marketing-filter-trigger";
import {
  SALEROOM_CATALOG_STATUS_OPTIONS,
  buildSaleroomClearStatusHref,
  buildSaleroomStatusHref,
  countActiveSaleroomStatusFilters,
  parseSaleroomCatalogStatus,
} from "@/lib/marketing/saleroom-catalog-status";
import type { SaleroomStatusCounts } from "@/lib/marketing/saleroom-status-counts";
import { MarketingFilterCheckboxRow } from "@auction/marketing-ui/marketing-filter-checkbox-row";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

export type SaleroomCatalogFilterSheetProps = {
  basePath: string;
  resultCountLabel: string;
  /** Lots per status; null when they could not be counted. */
  statusCounts: SaleroomStatusCounts | null;
  /** Open on mount: the trigger was pressed while this sheet was still being fetched. */
  defaultOpen?: boolean;
};

/** Mobile filter sheet for saleroom lot status on `/sales/[slug]/[id]`. */
export function SaleroomCatalogFilterSheet({
  basePath,
  resultCountLabel,
  statusCounts,
  defaultOpen = false,
}: SaleroomCatalogFilterSheetProps) {
  const [open, setOpen] = useState(defaultOpen);
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
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="mb-1 font-label text-xs text-on-surface-variant">Lot status</legend>
        {SALEROOM_CATALOG_STATUS_OPTIONS.filter((option) => option.value !== "all").map(
          (option) => {
            const active = status === option.value;
            const count = option.value === "all" ? undefined : statusCounts?.[option.value];
            return (
              <MarketingFilterCheckboxRow
                key={option.value}
                id={`saleroom-status-${option.value}`}
                label={option.label}
                count={count}
                checked={active}
                onCheckedChange={() => {
                  router.push(
                    buildSaleroomStatusHref(basePath, active ? "all" : option.value, searchParams),
                    { scroll: false },
                  );
                  close();
                }}
              />
            );
          },
        )}
      </fieldset>
    </MarketingFilterSheet>
  );
}
