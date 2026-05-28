import { SITE_LOGO_PATH, SITE_NAME, SITE_SEO_NAME, SITE_TAGLINE } from "@/lib/brand";
import {
  isIndexingAllowedAtBuildTime,
  noindexRobotsMetadata,
  withIndexingPolicy,
} from "@/lib/seo/is-indexing-allowed";
import { artistPath, lotPath, salePath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { Lot, Sale } from "@auction/types";
import type { Metadata } from "next";

function defaultOgImage(base: string) {
  return [{ url: new URL(SITE_LOGO_PATH, base).toString() }];
}

export function rootMetadataBase(): Metadata {
  const base = getSiteUrl();
  return {
    metadataBase: new URL(base),
    title: { default: SITE_SEO_NAME, template: `%s · ${SITE_NAME}` },
    description: SITE_TAGLINE,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      url: base,
      title: SITE_SEO_NAME,
      description: SITE_TAGLINE,
      images: defaultOgImage(base),
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_SEO_NAME,
      description: SITE_TAGLINE,
      images: defaultOgImage(base),
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
    openGraph: {
      type: "website",
      url,
      title: fullTitle,
      description: opts.description,
      images: defaultOgImage(base),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: opts.description,
      images: defaultOgImage(base),
    },
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
    sale.description?.trim().slice(0, 160) ??
    `Browse lots and bidding in ${sale.title} — ${SITE_NAME}.`;
  const fullTitle = `${sale.title} · ${SITE_NAME}`;
  return withIndexingPolicy({
    title: sale.title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: fullTitle,
      description: desc,
      images: defaultOgImage(base),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: desc,
      images: defaultOgImage(base),
    },
  });
}

export function metadataForLot(auction: Lot): Metadata {
  const base = getSiteUrl();
  const url = `${base}${lotPath(auction)}`;
  const title = `${auction.title}`;
  const description =
    auction.description?.slice(0, 160) ?? `Bid on ${auction.title} — curated fine art auction.`;
  return withIndexingPolicy({
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: `${title} · ${SITE_NAME}`,
      description,
      images: auction.images[0] ? [{ url: auction.images[0] }] : defaultOgImage(base),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${SITE_NAME}`,
      description,
      images: auction.images[0] ? [auction.images[0]] : defaultOgImage(base),
    },
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
  return withIndexingPolicy({
    title: `${seller.name} · Seller`,
    description: `Lots and auctions from ${seller.name}.`,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      url,
      title: `${seller.name} · ${SITE_NAME}`,
      description: `Seller profile — ${seller.name}`,
      images: defaultOgImage(base),
    },
    twitter: {
      card: "summary",
      title: `${seller.name} · ${SITE_NAME}`,
      description: `Seller profile — ${seller.name}`,
      images: defaultOgImage(base),
    },
  });
}
