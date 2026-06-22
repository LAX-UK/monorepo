import type { SaleAnchorTab } from "@/components/marketing/sale-anchor-tabs";

export function buildSaleAnchorTabs(opts: {
  showTelephone: boolean;
  showGallery?: boolean;
  showPress?: boolean;
}): SaleAnchorTab[] {
  return [
    { id: "catalog", label: "Catalogue" },
    ...(opts.showTelephone ? [{ id: "telephone", label: "Telephone bidding" }] : []),
    ...(opts.showGallery ? [{ id: "gallery", label: "Auction day" }] : []),
    ...(opts.showPress ? [{ id: "press", label: "Press" }] : []),
    { id: "overview", label: "Overview" },
  ];
}
