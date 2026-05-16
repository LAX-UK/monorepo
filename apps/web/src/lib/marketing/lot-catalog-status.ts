import type { LotStatus } from "@auction/types";

export type LotCatalogStatusPresentation = {
  label: string;
  className: string;
};

const LOT_CATALOG_STATUS: Record<LotStatus, LotCatalogStatusPresentation> = {
  active: { label: "live", className: "text-live-red" },
  cancelled: { label: "past", className: "text-brand-300" },
  draft: { label: "upcoming", className: "text-brand-300" },
  ended: { label: "past", className: "text-brand-300" },
  scheduled: { label: "upcoming", className: "text-lot-orange" },
  voided: { label: "voided", className: "text-brand-300" },
};

/** Artist / catalogue work tiles — lowercase editorial labels + tone classes. */
export function lotCatalogStatusPresentation(status: LotStatus): LotCatalogStatusPresentation {
  return LOT_CATALOG_STATUS[status];
}
