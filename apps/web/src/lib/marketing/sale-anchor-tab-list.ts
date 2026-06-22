import type { SaleAnchorTab } from "@/components/marketing/sale-anchor-tabs";

export function buildSaleAnchorTabs(opts: {
  showTelephone: boolean;
  showGallery?: boolean;
}): SaleAnchorTab[] {
  return [
    { id: "catalog", label: "Catalogue" },
    ...(opts.showTelephone ? [{ id: "telephone", label: "Telephone bidding" }] : []),
    ...(opts.showGallery ? [{ id: "gallery", label: "Auction day" }] : []),
    { id: "overview", label: "Overview" },
  ];
}
