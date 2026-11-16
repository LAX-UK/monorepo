import type { SaleListRow } from "@/lib/data/http/sales.server";
import { metadataForListing } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { salePath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { Metadata } from "next";

/** Query params that filter or sort the calendar; any of them makes a faceted, thin address. */
const SALES_FACET_PARAMS = [
  "categoryId",
  "delivery",
  "location",
  "sort",
  "month",
  "year",
  "minPrice",
  "maxPrice",
] as const;

function hasFacetParam(sp: Record<string, string | string[] | undefined>): boolean {
  return SALES_FACET_PARAMS.some((key) => {
    const v = sp[key];
    const first = Array.isArray(v) ? v[0] : v;
    return typeof first === "string" && first.trim().length > 0;
  });
}

/**
 * `/sales` metadata. The filter rail's options are crawlable links, so a filtered or sorted
 * address gets `noindex, follow` with canonical `/sales`, as `/search` and `/press` do.
 */
export function salesBrowsePageMetadata(
  sp: Record<string, string | string[] | undefined>,
): Metadata {
  return metadataForListing({
    title: "Calendar",
    description:
      "Explore upcoming auctions and browse past results from London, featuring the best of Modern & Contemporary Art, Design, and luxury.",
    path: "/sales",
    noIndex: hasFacetParam(sp),
  });
}

export type BuildSalesBrowsePageSeoInput = {
  loadFailed: boolean;
  filteredSales: SaleListRow[];
};

export function buildSalesBrowsePageJsonLd(input: BuildSalesBrowsePageSeoInput): {
  crumbText: string;
  listLdText: string | null;
} {
  const base = getSiteUrl();
  const crumbLd = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Calendar", path: "/sales" },
  ]);
  const crumbText = jsonLdScript(crumbLd);

  const listLdSource = input.filteredSales.map((r) => ({
    name: r.sale.title,
    url: `${base}${salePath(r.sale)}`,
  }));
  const listLd = !input.loadFailed && listLdSource.length > 0 ? itemListJsonLd(listLdSource) : null;
  const listLdText = listLd ? jsonLdScript(listLd) : null;

  return { crumbText, listLdText };
}
