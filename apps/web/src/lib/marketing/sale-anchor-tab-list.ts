import type { SaleAnchorTab } from "@/components/marketing/sale-anchor-tabs";

export function buildSaleAnchorTabs(opts: { showTelephone: boolean }): SaleAnchorTab[] {
  return [
    { id: "catalog", label: "Catalogue" },
    ...(opts.showTelephone ? [{ id: "telephone", label: "Telephone bidding" }] : []),
    { id: "overview", label: "Overview" },
  ];
}
