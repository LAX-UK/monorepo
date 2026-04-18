import { SITE_NAME, SITE_TAGLINE } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";
import type { Lot } from "@auction/types";
import type { Metadata } from "next";

export function rootMetadataBase(): Metadata {
  const base = getSiteUrl();
  return {
    metadataBase: new URL(base),
    title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
    description: SITE_TAGLINE,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      url: base,
      title: SITE_NAME,
      description: SITE_TAGLINE,
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_NAME,
      description: SITE_TAGLINE,
    },
    robots: { index: true, follow: true },
  };
}

export function metadataForLot(auction: Lot): Metadata {
  const base = getSiteUrl();
  const url = `${base}/artwork/${auction.id}`;
  const title = `${auction.title}`;
  const description =
    auction.description?.slice(0, 160) ?? `Bid on ${auction.title} — curated fine art auction.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: `${title} · ${SITE_NAME}`,
      description,
      images: auction.images[0] ? [{ url: auction.images[0] }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${SITE_NAME}`,
      description,
      images: auction.images[0] ? [auction.images[0]] : undefined,
    },
  };
}

export function metadataForSeller(name: string, sellerId: string): Metadata {
  const base = getSiteUrl();
  const url = `${base}/artist/${sellerId}`;
  return {
    title: `${name} · Seller`,
    description: `Lots and auctions from ${name}.`,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      url,
      title: `${name} · ${SITE_NAME}`,
      description: `Seller profile — ${name}`,
    },
    twitter: {
      card: "summary",
      title: `${name} · ${SITE_NAME}`,
      description: `Seller profile — ${name}`,
    },
  };
}
