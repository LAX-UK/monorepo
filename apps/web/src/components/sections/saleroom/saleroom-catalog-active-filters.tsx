"use client";

import { CatalogActiveFilterChips } from "@/components/marketing/catalog-active-filter-chips";
import {
  buildSaleroomClearStatusHref,
  parseSaleroomCatalogStatus,
  saleroomStatusLabel,
} from "@/lib/marketing/saleroom-catalog-status";
import { useSearchParams } from "next/navigation";

type Props = {
  basePath: string;
  className?: string;
};

/** Removable active status chip for the saleroom catalogue (parity with search active filters). */
export function SaleroomCatalogActiveFilters({ basePath, className }: Props) {
  const params = useSearchParams();
  const searchParams = new URLSearchParams(params?.toString() ?? "");
  const status = parseSaleroomCatalogStatus(searchParams.get("status"));

  if (status === "all") return null;

  const clearHref = buildSaleroomClearStatusHref(basePath, searchParams);
  const chips = [{ key: "status", label: saleroomStatusLabel(status), removeHref: clearHref }];

  return (
    <CatalogActiveFilterChips
      chips={chips}
      clearHref={clearHref}
      {...(className ? { className } : {})}
    />
  );
}
