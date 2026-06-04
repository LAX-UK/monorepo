import { SITE_NAME, SITE_SEO_NAME, SITE_TAGLINE, SITE_TWITTER_HANDLE } from "@/lib/brand";
import {
  isIndexingAllowedAtBuildTime,
  noindexRobotsMetadata,
  withIndexingPolicy,
} from "@/lib/seo/is-indexing-allowed";
import { truncateMetaDescription } from "@/lib/seo/meta-description";
import { artistPath, lotPath, salePath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { Lot, Sale } from "@auction/types";
import type { Metadata } from "next";

const twitterCardBase = {
  card: "summary_large_image" as const,
  site: SITE_TWITTER_HANDLE,
  creator: SITE_TWITTER_HANDLE,
};

/** Open Graph / Twitter text fields only — images come from co-located `opengraph-image.tsx`. */
function socialTextFields(opts: {
  url: string;
  title: string;
  description: string;
  type?: "website" | "profile";
}) {
  return {
    openGraph: {
      type: opts.type ?? "website",
      locale: "en_GB",
      url: opts.url,
      title: opts.title,
      description: opts.description,
    },
    twitter: {
      ...twitterCardBase,
      title: opts.title,
      description: opts.description,
    },
  };
}

export function rootMetadataBase(): Metadata {
  const base = getSiteUrl();
  return {
    metadataBase: new URL(base),
    title: { default: SITE_SEO_NAME, template: `%s · ${SITE_NAME}` },
    description: SITE_TAGLINE,
    openGraph: {
      type: "website",
      locale: "en_GB",
      siteName: SITE_NAME,
      url: base,
      title: SITE_SEO_NAME,
      description: SITE_TAGLINE,
    },
    twitter: {
      ...twitterCardBase,
      title: SITE_SEO_NAME,
      description: SITE_TAGLINE,
    },
    robots: isIndexingAllowedAtBuildTime()
      ? { index: true, follow: true }
      : noindexRobotsMetadata(),
  };
}

/** Static marketing / legal pages */
export function metadataForStatic(opts: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const base = getSiteUrl();
  const path = opts.path.startsWith("/") ? opts.path : `/${opts.path}`;
  const url = `${base}${path}`;
  const fullTitle = `${opts.title} · ${SITE_NAME}`;
  return withIndexingPolicy({
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    ...socialTextFields({
      url,
      title: fullTitle,
      description: opts.description,
    }),
  });
}

/** Faceted listing pages (search, future faceted catalog) — `noIndex` mirrors thin-URL hygiene. */
export function metadataForListing(opts: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  const base = metadataForStatic({
    title: opts.title,
    description: opts.description,
    path: opts.path,
  });
  if (opts.noIndex) {
    return { ...base, robots: { index: false, follow: true } };
  }
  return withIndexingPolicy(base);
}

/** Sale catalog page */
export function metadataForSale(sale: Pick<Sale, "id" | "title" | "description">): Metadata {
  const base = getSiteUrl();
  const url = `${base}${salePath(sale)}`;
  const desc =
    (sale.description?.trim() ? truncateMetaDescription(sale.description) : null) ??
    `Browse lots and bidding in ${sale.title} — ${SITE_NAME}.`;
  const fullTitle = `${sale.title} · ${SITE_NAME}`;
  return withIndexingPolicy({
    title: sale.title,
    description: desc,
    alternates: { canonical: url },
    ...socialTextFields({ url, title: fullTitle, description: desc }),
  });
}

export function metadataForLot(auction: Pick<Lot, "id" | "title" | "description">): Metadata {
  const base = getSiteUrl();
  const url = `${base}${lotPath(auction)}`;
  const title = `${auction.title}`;
  const description =
    (auction.description?.trim() ? truncateMetaDescription(auction.description) : null) ??
    `Bid on ${auction.title} — curated fine art auction.`;
  const ogTitle = `${title} · ${SITE_NAME}`;
  return withIndexingPolicy({
    title,
    description,
    alternates: { canonical: url },
    ...socialTextFields({ url, title: ogTitle, description }),
  });
}

export function metadataForNotFound(title: string, description?: string): Metadata {
  return {
    title,
    description: description ?? `${title} \u00B7 ${SITE_NAME}`,
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  };
}

/** Defense-in-depth metadata for private (dashboard / admin / accountant)
 * routes. Robots.txt already disallows these paths but accidental link sharing
 * could still index them; this metadata provides an HTML-level signal.
 */
export function metadataForPrivate(title: string, description?: string): Metadata {
  return {
    title,
    description: description ?? `${title} \u00B7 ${SITE_NAME}`,
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  };
}

export function metadataForSeller(seller: { id: string; name: string }): Metadata {
  const base = getSiteUrl();
  const url = `${base}${artistPath(seller)}`;
  const ogTitle = `${seller.name} · ${SITE_NAME}`;
  const description = `Lots and auctions from ${seller.name}.`;
  return withIndexingPolicy({
    title: `${seller.name} · Seller`,
    description,
    alternates: { canonical: url },
    ...socialTextFields({
      url,
      title: ogTitle,
      description: `Seller profile — ${seller.name}`,
      type: "profile",
    }),
  });
}
