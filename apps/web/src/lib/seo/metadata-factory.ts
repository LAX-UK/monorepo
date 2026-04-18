import { getSiteUrl } from "@/lib/site-url";
import type { Lot } from "@auction/types";
import type { Metadata } from "next";

const siteName = "The Digital Curator";

export function rootMetadataBase(): Metadata {
  const base = getSiteUrl();
  return {
    metadataBase: new URL(base),
    title: { default: siteName, template: `%s · ${siteName}` },
    description: "Fine art auctions — curated lots and live bidding.",
    openGraph: {
      type: "website",
      siteName,
      url: base,
      title: siteName,
      description: "Fine art auctions — curated lots and live bidding.",
    },
    twitter: {
      card: "summary_large_image",
      title: siteName,
      description: "Fine art auctions — curated lots and live bidding.",
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
      title: `${title} · ${siteName}`,
      description,
      images: auction.images[0] ? [{ url: auction.images[0] }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${siteName}`,
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
      title: `${name} · ${siteName}`,
      description: `Seller profile — ${name}`,
    },
    twitter: {
      card: "summary",
      title: `${name} · ${siteName}`,
      description: `Seller profile — ${name}`,
    },
  };
}
