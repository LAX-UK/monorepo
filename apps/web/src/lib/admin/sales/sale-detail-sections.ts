import type { SaleDetailTab } from "@/lib/admin/sales/sale-detail-routes";

/**
 * What a sale page needs before it is offered. `manage-sales` is `SALES_ACCESS`: registrations,
 * telephone bookings, saleroom operations and ATG are auction-management actions the API refuses
 * to anyone else. `saleroom` is an onsite or hybrid sale, the only kind with a room, a day's media
 * and telephone bidders.
 */
export type SaleSectionRequirement = "manage-sales" | "saleroom";

export type SaleSectionContext = {
  canManageSales: boolean;
  isSaleroom: boolean;
};

const REQUIREMENT_MET: Record<SaleSectionRequirement, (context: SaleSectionContext) => boolean> = {
  "manage-sales": (context) => context.canManageSales,
  saleroom: (context) => context.isSaleroom,
};

/** Each sale page: its label and what the viewer and the sale need for it to be offered. */
export const SALE_DETAIL_SECTIONS: Record<
  SaleDetailTab,
  { label: string; requires: readonly SaleSectionRequirement[] }
> = {
  overview: { label: "Overview", requires: [] },
  lots: { label: "Lots", requires: [] },
  registrations: { label: "Registrations", requires: ["manage-sales"] },
  "telephone-bookings": { label: "Telephone bookings", requires: ["manage-sales", "saleroom"] },
  operations: { label: "Operations", requires: ["manage-sales", "saleroom"] },
  cover: { label: "Cover and home", requires: [] },
  media: { label: "Media", requires: ["saleroom"] },
  press: { label: "Press", requires: [] },
  documents: { label: "Documents", requires: [] },
  schedule: { label: "Schedule", requires: [] },
  atg: { label: "ATG", requires: ["manage-sales"] },
};

export type SaleDetailGroupId =
  | "overview"
  | "lots"
  | "bidders"
  | "sale-day"
  | "content"
  | "settings";

/**
 * The sale's top-level tabs, grouped by the job a person came to do, each with its pages in
 * order. A page keeps its own URL, so links into any page land on it inside its group.
 */
export const SALE_DETAIL_GROUPS: readonly {
  id: SaleDetailGroupId;
  label: string;
  sections: readonly SaleDetailTab[];
}[] = [
  { id: "overview", label: "Overview", sections: ["overview"] },
  { id: "lots", label: "Lots", sections: ["lots"] },
  { id: "bidders", label: "Bidders", sections: ["registrations", "telephone-bookings"] },
  { id: "sale-day", label: "Sale day", sections: ["operations"] },
  { id: "content", label: "Content", sections: ["cover", "media", "press", "documents"] },
  { id: "settings", label: "Settings", sections: ["schedule", "atg"] },
];

/** Whether this viewer is offered this page of this sale. */
export function isSaleSectionAvailable(
  section: SaleDetailTab,
  context: SaleSectionContext,
): boolean {
  return SALE_DETAIL_SECTIONS[section].requires.every((requirement) =>
    REQUIREMENT_MET[requirement](context),
  );
}
