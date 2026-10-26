import type { MerchandiseProductListItem, MerchandiseStatus } from "@auction/shop-contracts";
import { formatStaffMoney } from "@auction/staff-ui";
import { staffStatusLabel } from "./staff-status";
import { defineWorkList } from "./work-list.vm";

export const MERCHANDISE_SEARCH_MAX_LENGTH = 100;

/*
 * Products: a view for all, on sale and archived products, a search by title, slug or SKU and the
 * product open in the panel (`?product=`). The API orders newest first, with the id as a
 * tiebreaker, and the rows carry no created date, so the list shows no sort: `created` is the one
 * sort key and is never sent to the API.
 */
export const merchandiseList = defineWorkList({
  path: "/merchandise",
  views: [
    { id: "all", label: "All", api: {} },
    {
      id: "active",
      label: staffStatusLabel("merchandise", "active"),
      api: { status: "active" },
      statuses: ["active"],
    },
    {
      id: "archived",
      label: staffStatusLabel("merchandise", "archived"),
      api: { status: "archived" },
      statuses: ["archived"],
    },
  ],
  defaultView: "all",
  filters: {},
  sorts: { created: { asc: "created", desc: "created" } },
  defaultSort: "created",
  panelParam: "product",
  searchMaxLength: MERCHANDISE_SEARCH_MAX_LENGTH,
});

export type MerchandiseListRow = {
  id: string;
  title: string;
  slug: string;
  status: MerchandiseStatus;
  /** Variants still on sale. */
  variantCount: number;
  fromPricePence: number | null;
  toPricePence: number | null;
  /** Stock on hand across the variants on sale. */
  totalOnHand: number;
};

export function toMerchandiseListRow(item: MerchandiseProductListItem): MerchandiseListRow {
  return {
    id: item.productId,
    title: item.title,
    slug: item.slug,
    status: item.status,
    variantCount: item.variantCount,
    fromPricePence: item.fromPricePence,
    toPricePence: item.toPricePence,
    totalOnHand: item.totalOnHand,
  };
}

/** "3 variants", or "No variants on sale" when every variant is archived. */
export function variantsLabel(count: number): string {
  if (count === 0) return "No variants on sale";
  return `${count} ${count === 1 ? "variant" : "variants"}`;
}

/** "£15.00" or "£15.00 – £25.00"; null when no variant is on sale. */
export function priceRangeLabel(from: number | null, to: number | null): string | null {
  if (from === null || to === null) return null;
  return from === to
    ? formatStaffMoney(from)
    : `${formatStaffMoney(from)} – ${formatStaffMoney(to)}`;
}
