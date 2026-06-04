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

function buildRemoveHref(basePath: string, current: URLSearchParams, keys: string[]): string {
  const next = new URLSearchParams(current);
  for (const k of keys) next.delete(k);
  next.delete("page");
  const qs = next.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Removable active status chip for the saleroom catalogue (parity with search active filters). */
export function SaleroomCatalogActiveFilters({ basePath, className }: Props) {
  const params = useSearchParams();
  const searchParams = new URLSearchParams(params?.toString() ?? "");
  const status = parseSaleroomCatalogStatus(searchParams.get("status"));
  const query = (searchParams.get("q") ?? "").trim();

  const chips: { key: string; label: string; removeHref: string }[] = [];
  if (query) {
    chips.push({
      key: "q",
      label: `“${query}”`,
      removeHref: buildRemoveHref(basePath, searchParams, ["q"]),
    });
  }
  if (status !== "all") {
    chips.push({
      key: "status",
      label: saleroomStatusLabel(status),
      removeHref: buildSaleroomClearStatusHref(basePath, searchParams),
    });
  }

  if (chips.length === 0) return null;

  const clearHref = buildRemoveHref(basePath, searchParams, ["q", "status"]);

  return (
    <CatalogActiveFilterChips
      chips={chips}
      clearHref={clearHref}
      {...(className ? { className } : {})}
    />
  );
}
