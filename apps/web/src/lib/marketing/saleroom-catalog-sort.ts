export type SaleroomCatalogSort = "lot" | "priceAsc" | "priceDesc" | "endingAsc";

export const SALEROOM_CATALOG_SORT_OPTIONS: ReadonlyArray<{
  label: string;
  value: SaleroomCatalogSort;
}> = [
  { label: "Lot order", value: "lot" },
  { label: "Ending soonest", value: "endingAsc" },
  { label: "Price: low to high", value: "priceAsc" },
  { label: "Price: high to low", value: "priceDesc" },
];

export function parseSaleroomCatalogSort(raw: string | null | undefined): SaleroomCatalogSort {
  if (raw === "priceAsc" || raw === "priceDesc" || raw === "endingAsc") return raw;
  return "lot";
}

export function saleroomCatalogSortLabel(value: SaleroomCatalogSort): string {
  return SALEROOM_CATALOG_SORT_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
