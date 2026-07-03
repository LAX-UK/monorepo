import { coerceToIsoString } from "@/lib/data/http/parse";
import { getSiteUrl } from "@/lib/site-url";
import type { Sale } from "@auction/types";
import { breadcrumbJsonLd } from "./catalog";
import { saleEventJsonLd } from "./sale";
import { jsonLdScript } from "./script";
import { organizationJsonLd } from "./site";

/** Home page root document (pairs with `breadcrumbJsonLd` via optional `@id` link). */
export function webPageJsonLd(opts: {
  url: string;
  name: string;
  description?: string;
  breadcrumbId?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: opts.url,
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.breadcrumbId ? { breadcrumb: { "@id": opts.breadcrumbId } } : {}),
  };
}

/** `ItemList` of `Event` entries for upcoming sales on the marketing home page. */
export function homeUpcomingItemListJsonLd(sales: Sale[]): Record<string, unknown> {
  const datedSales = sales.filter(
    (sale) => coerceToIsoString(sale.startTime) && coerceToIsoString(sale.endTime),
  );
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: datedSales.map((sale, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: saleEventJsonLd(sale),
    })),
  };
}

/** Breadcrumb + WebPage + Organization for long-form pages inside `PolicyHubLayout`. */
export function policyHubPageJsonLd(opts: {
  path: string;
  breadcrumbName: string;
  pageName: string;
  description: string;
}): string {
  const base = getSiteUrl();
  const path = opts.path.startsWith("/") ? opts.path : `/${opts.path}`;
  const url = `${base}${path}`;
  const breadcrumbId = `${url}#breadcrumb`;
  const crumbs = breadcrumbJsonLd(
    [
      { name: "Home", path: "/" },
      { name: opts.breadcrumbName, path },
    ],
    { graphId: breadcrumbId },
  );
  const page = webPageJsonLd({
    url,
    name: opts.pageName,
    description: opts.description,
    breadcrumbId,
  });
  return jsonLdScript(crumbs, page, organizationJsonLd());
}
