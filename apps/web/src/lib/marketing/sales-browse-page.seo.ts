import type { SaleListRow } from "@/lib/data/http/sales.server";
import type { CalendarPrimaryTab } from "@/lib/marketing/sales-calendar-params";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { lotPath, salePath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { Lot } from "@auction/types";
import type { Metadata } from "next";

export const salesBrowsePageMetadata: Metadata = metadataForStatic({
  title: "Calendar",
  description:
    "Explore upcoming auctions and browse past results from London, featuring the best of Modern & Contemporary Art, Design, and luxury.",
  path: "/sales",
});

export type BuildSalesBrowsePageSeoInput = {
  tab: CalendarPrimaryTab;
  err: string | null;
  newLots: Lot[];
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

  const listLdSource =
    input.tab === "newLots"
      ? input.newLots.map((l) => ({ name: l.title, url: `${base}${lotPath(l)}` }))
      : input.filteredSales.map((r) => ({
          name: r.sale.title,
          url: `${base}${salePath(r.sale)}`,
        }));
  const listLd = !input.err && listLdSource.length > 0 ? itemListJsonLd(listLdSource) : null;
  const listLdText = listLd ? jsonLdScript(listLd) : null;

  return { crumbText, listLdText };
}
