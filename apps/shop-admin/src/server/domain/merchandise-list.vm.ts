import { formatAdminDetailGbpPence } from "@/lib/admin-detail-format";
import type { MerchandiseProductListItem, MerchandiseStatus } from "@auction/shop-contracts";

export type MerchandiseStatusFilter = "all" | MerchandiseStatus;

export type MerchandiseListSearch = {
  q: string;
  status: MerchandiseStatusFilter;
  cursor: string | undefined;
};

export type MerchandiseListRow = {
  id: string;
  title: string;
  slug: string;
  status: MerchandiseStatus;
  /** "3 variants", or "No variants on sale" when every variant is archived. */
  variants: string;
  price: string;
  stock: string;
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Reads `q`, `status` and `cursor` from the URL; anything unrecognised falls back to its default. */
export function parseMerchandiseListSearch(params: {
  q?: string | string[];
  status?: string | string[];
  cursor?: string | string[];
}): MerchandiseListSearch {
  const status = first(params.status);
  return {
    q: first(params.q).trim().slice(0, 100),
    status: status === "active" || status === "archived" ? status : "all",
    cursor: first(params.cursor).trim() || undefined,
  };
}

/** The query the API list route takes for a search state; `all` is expressed by leaving it out. */
export function merchandiseApiQuery(search: MerchandiseListSearch): Record<string, string> {
  return {
    ...(search.q ? { q: search.q } : {}),
    ...(search.status !== "all" ? { status: search.status } : {}),
  };
}

/** List URL for a search state, leaving out defaults so the address stays short and shareable. */
export function merchandiseListUrl(search: MerchandiseListSearch): string {
  const params = new URLSearchParams(merchandiseApiQuery(search));
  if (search.cursor) params.set("cursor", search.cursor);
  const query = params.toString();
  return `/merchandise${query ? `?${query}` : ""}`;
}

function priceRange(from: number | null, to: number | null): string {
  if (from === null || to === null) return "—";
  return from === to
    ? formatAdminDetailGbpPence(from)
    : `${formatAdminDetailGbpPence(from)} – ${formatAdminDetailGbpPence(to)}`;
}

export function toMerchandiseListRow(item: MerchandiseProductListItem): MerchandiseListRow {
  return {
    id: item.productId,
    title: item.title,
    slug: item.slug,
    status: item.status,
    variants:
      item.variantCount === 0
        ? "No variants on sale"
        : `${item.variantCount} ${item.variantCount === 1 ? "variant" : "variants"}`,
    price: priceRange(item.fromPricePence, item.toPricePence),
    stock: String(item.totalOnHand),
  };
}
