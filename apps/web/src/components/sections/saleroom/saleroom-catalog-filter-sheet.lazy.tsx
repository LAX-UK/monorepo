"use client";

import { MarketingFilterTrigger } from "@/components/marketing/marketing-filter-trigger";
import type { SaleroomCatalogFilterSheetProps } from "@/components/sections/saleroom/saleroom-catalog-filter-sheet";
import { useDeferredModule } from "@/hooks/use-deferred-module";
import {
  countActiveSaleroomStatusFilters,
  parseSaleroomCatalogStatus,
} from "@/lib/marketing/saleroom-catalog-status";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

const loadFilterSheet = () =>
  import("@/components/sections/saleroom/saleroom-catalog-filter-sheet").then(
    (module) => module.SaleroomCatalogFilterSheet,
  );

/**
 * The phone filter sheet and its drawer library are fetched once the page has hydrated, not with
 * its first scripts. Until then the same trigger, with the same badge, stands in for it. A press
 * on the stand-in is kept: the sheet opens as soon as it arrives. If the fetch failed, pointing at,
 * focusing or pressing the trigger fetches it again.
 */
export function LazySaleroomCatalogFilterSheet(
  props: Omit<SaleroomCatalogFilterSheetProps, "defaultOpen">,
) {
  const loaded = useDeferredModule(loadFilterSheet, true);
  const params = useSearchParams();
  const [pressed, setPressed] = useState(false);

  if (loaded.status === "ready") return <loaded.value {...props} defaultOpen={pressed} />;

  const retryIfFailed = () => {
    if (loaded.status === "failed") loaded.retry();
  };
  return (
    <MarketingFilterTrigger
      activeCount={countActiveSaleroomStatusFilters(
        parseSaleroomCatalogStatus(params?.get("status")),
      )}
      onPointerEnter={retryIfFailed}
      onFocus={retryIfFailed}
      onClick={() => {
        setPressed(true);
        retryIfFailed();
      }}
    />
  );
}
