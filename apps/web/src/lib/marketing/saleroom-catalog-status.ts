export type SaleroomCatalogStatus = "all" | "live" | "upcoming" | "ended";

export const SALEROOM_CATALOG_STATUS_OPTIONS: ReadonlyArray<{
  label: string;
  value: SaleroomCatalogStatus;
}> = [
  { label: "All", value: "all" },
  { label: "Live", value: "live" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Ended", value: "ended" },
];

export function parseSaleroomCatalogStatus(raw: string | null | undefined): SaleroomCatalogStatus {
  if (raw === "live" || raw === "upcoming" || raw === "ended") return raw;
  return "all";
}

export function buildSaleroomStatusHref(
  basePath: string,
  value: SaleroomCatalogStatus,
  current: URLSearchParams,
): string {
  const next = new URLSearchParams(current);
  if (value === "all") {
    next.delete("status");
  } else {
    next.set("status", value);
  }
  next.delete("page");
  const qs = next.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function buildSaleroomClearStatusHref(basePath: string, current: URLSearchParams): string {
  return buildSaleroomStatusHref(basePath, "all", current);
}

export function saleroomStatusLabel(value: SaleroomCatalogStatus): string {
  return SALEROOM_CATALOG_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function countActiveSaleroomStatusFilters(status: SaleroomCatalogStatus): number {
  return status === "all" ? 0 : 1;
}
