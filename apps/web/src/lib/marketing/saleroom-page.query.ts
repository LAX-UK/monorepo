import {
  type SaleroomCatalogSort,
  parseSaleroomCatalogSort,
} from "@/lib/marketing/saleroom-catalog-sort";
import { parseUrlLayoutView } from "@/lib/preferences/resolve-layout-view";
import { salePath, slugify } from "@/lib/seo/url";
import type { Sale } from "@auction/types";
import { appendMarketingPassthroughParams } from "@auction/validators";

export const SALEROOM_CATALOG_PAGE_SIZE = 40;

export type SaleroomCatalogStatusFilter = "live" | "upcoming" | "ended";

export type SaleroomPageQuery = {
  pageRaw: string | undefined;
  catalogSearch: string;
  catalogSort: SaleroomCatalogSort;
  statusFilter: SaleroomCatalogStatusFilter | null;
  isCatalogLoadAll: boolean;
  pageNum: number;
  layoutViewRaw: ReturnType<typeof parseUrlLayoutView>;
  urlView: ReturnType<typeof parseUrlLayoutView>;
};

export function firstSearchParam(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === "string" ? v : v[0];
}

function parsePage(raw: string | undefined): number {
  if (raw === "all") return 1;
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 500) : 1;
}

export function parseSaleroomPageQuery(
  sp: Record<string, string | string[] | undefined>,
): SaleroomPageQuery {
  const pageRaw = firstSearchParam(sp.page);
  const catalogSearch = (firstSearchParam(sp.q) ?? "").trim();
  const catalogSort = parseSaleroomCatalogSort(firstSearchParam(sp.sort));
  const statusFilterRaw = firstSearchParam(sp.status);
  const statusFilter: SaleroomCatalogStatusFilter | null =
    statusFilterRaw === "live" || statusFilterRaw === "upcoming" || statusFilterRaw === "ended"
      ? statusFilterRaw
      : null;
  const isCatalogLoadAll = pageRaw === "all" || catalogSearch !== "" || statusFilter != null;
  const pageNum = isCatalogLoadAll ? 1 : parsePage(pageRaw);
  const urlView = parseUrlLayoutView(firstSearchParam(sp.view));

  return {
    pageRaw,
    catalogSearch,
    catalogSort,
    statusFilter,
    isCatalogLoadAll,
    pageNum,
    layoutViewRaw: urlView,
    urlView,
  };
}

export function canonicalSalePathWithQuery(
  sale: Sale,
  sp: Record<string, string | string[] | undefined>,
) {
  const qs = new URLSearchParams();
  const page = firstSearchParam(sp.page);
  if (page) qs.set("page", page);
  const view = parseUrlLayoutView(firstSearchParam(sp.view));
  if (view) qs.set("view", view);
  appendMarketingPassthroughParams(qs, sp);
  const q = qs.toString();
  const path = salePath(sale);
  return q ? `${path}?${q}` : path;
}

export function saleSlugMismatchPath(slug: string, sale: Sale): string | null {
  return slug !== slugify(sale.title) ? salePath(sale) : null;
}
