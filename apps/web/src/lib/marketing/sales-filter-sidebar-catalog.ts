/** Accordion `value` + human label for the sales calendar filter sidebar (data only). */
export const SALES_FILTER_SIDEBAR_GROUPS = [
  { value: "delivery", title: "Auction Type" },
  { value: "location", title: "Location" },
  { value: "sort", title: "Sort by Date" },
  { value: "price", title: "Price" },
  { value: "department", title: "Department" },
  { value: "month", title: "Month" },
  { value: "year", title: "Year" },
] as const;

export type SalesFilterSidebarGroupValue = (typeof SALES_FILTER_SIDEBAR_GROUPS)[number]["value"];

/** High-intent groups expanded by default on desktop; collapse after the first five. */
export const SALES_FILTER_SIDEBAR_DEFAULT_OPEN: SalesFilterSidebarGroupValue[] = [
  "delivery",
  "location",
  "sort",
];
