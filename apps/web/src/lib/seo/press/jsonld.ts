import {
  SITE_CONTACT_EMAIL,
  SITE_NAME,
  SITE_PRESS_EMAIL,
  SITE_TELEPHONE_SCHEMA,
} from "@/lib/brand";
import { salePath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { PressArchiveEntry, Sale, SalePressItem } from "@auction/types";

function pressCoverageItemJsonLd(
  sale: Pick<Sale, "id" | "title">,
  item: SalePressItem,
): Record<string, unknown> {
  const saleUrl = `${getSiteUrl()}${salePath(sale)}`;
  return {
    "@type": "WebPage",
    url: item.url,
    name: item.headline,
    ...(item.excerpt ? { description: item.excerpt } : {}),
    ...(item.publishedAt ? { datePublished: item.publishedAt } : {}),
    isPartOf: {
      "@type": "NewsMediaOrganization",
      name: item.outletName,
    },
    about: {
      "@type": "Event",
      name: sale.title,
      url: saleUrl,
    },
  };
}

/** ItemList JSON-LD for curated press on a sale detail page (#press). */
export function salePressJsonLd(
  sale: Sale,
  items: SalePressItem[],
): Record<string, unknown> | null {
  if (items.length === 0) return null;
  const base = getSiteUrl();
  const saleUrl = `${base}${salePath(sale)}`;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Press coverage for ${sale.title}`,
    url: `${saleUrl}#press`,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: pressCoverageItemJsonLd(sale, item),
    })),
  };
}

export function pressHubJsonLd(opts: {
  url: string;
  entries: PressArchiveEntry[];
  lastUpdated: Date | null;
  /** Full archive count (unfiltered). Used when `includeItemList` is true. */
  totalItems?: number;
  /** Omit partial/filtered ItemList — keep CollectionPage + publisher only. */
  includeItemList?: boolean;
}): Record<string, unknown> {
  const publisher = {
    "@type": "Organization",
    name: SITE_NAME,
    url: getSiteUrl(),
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "press",
        email: SITE_PRESS_EMAIL,
        telephone: SITE_TELEPHONE_SCHEMA,
        availableLanguage: ["English"],
      },
      {
        "@type": "ContactPoint",
        contactType: "customer service",
        email: SITE_CONTACT_EMAIL,
        telephone: SITE_TELEPHONE_SCHEMA,
        availableLanguage: ["English"],
      },
    ],
  };

  const page: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Press & media · ${SITE_NAME}`,
    url: opts.url,
    ...(opts.lastUpdated ? { dateModified: opts.lastUpdated.toISOString() } : {}),
    publisher,
  };

  if (opts.includeItemList !== false && opts.entries.length > 0) {
    page.mainEntity = {
      "@type": "ItemList",
      numberOfItems: opts.totalItems ?? opts.entries.length,
      itemListElement: opts.entries.slice(0, 50).map((entry, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: pressCoverageItemJsonLd(entry.sale, entry.item),
      })),
    };
  }

  return page;
}
