import "server-only";

import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import type { ArtistProfile } from "@/lib/data/contracts";
import { portraitForPublicArtist } from "@/lib/data/http/artist.server";
import { getServerApiBase } from "@/lib/data/http/hc-server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getMarketingMegaMenuSections } from "@/lib/marketing/mega-menu-catalog";
import { artistPath } from "@/lib/seo/url";

async function fetchMenuArtists(): Promise<ArtistProfile[]> {
  if (process.env.NEXT_PUBLIC_ENABLE_ARTISTS === "false") return [];
  const res = await fetch(`${getServerApiBase()}/artists/public?limit=6&offset=0`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const body = (await res.json()) as {
    data: {
      id: string;
      displayName: string;
      portraitUrl?: string | null;
      shortBio?: string | null;
      nationality?: string | null;
    }[];
  };
  return body.data.map((row) => ({
    id: row.id,
    name: row.displayName,
    tagline: row.nationality?.trim() || "Catalogue artist",
    bio: row.shortBio ?? "",
    portraitUrl: portraitForPublicArtist(row.portraitUrl ?? null),
    stats: [],
  }));
}

/** Prepends API teaser rows to the Artists column without mutating the catalog. */
function mergeArtistTeasersIntoSections(
  sections: MegaMenuSection[],
  artists: ArtistProfile[],
): MegaMenuSection[] {
  if (artists.length === 0) return sections;
  return sections.map((section) => {
    if (section.id !== "artists") return section;
    const teasers = artists.map((artist) => ({
      href: artistPath(artist),
      label: artist.name,
    }));
    return { ...section, items: [...teasers, ...section.items] };
  });
}

function rewriteDashboardHref(href: string): string {
  if (!href.startsWith("/dashboard/")) return href;
  return `/login?next=${encodeURIComponent(href)}`;
}

/** Logged-out users should not land on dashboard routes from the marketing mega menu. */
function rewriteMegaMenuForGuest(sections: MegaMenuSection[]): MegaMenuSection[] {
  return sections.map((section) => ({
    ...section,
    href: rewriteDashboardHref(section.href),
    items: section.items.map((item) => ({
      ...item,
      href: rewriteDashboardHref(item.href),
    })),
  }));
}

export async function loadMegaMenuSections(): Promise<MegaMenuSection[]> {
  const [session, merged] = await Promise.all([
    getServerSessionUser(),
    (async (): Promise<MegaMenuSection[]> => {
      const base = getMarketingMegaMenuSections();
      if (process.env.NEXT_PUBLIC_ENABLE_ARTISTS === "false") {
        return base;
      }
      try {
        const artists = await fetchMenuArtists();
        return mergeArtistTeasersIntoSections(base, artists);
      } catch {
        return base;
      }
    })(),
  ]);

  if (!session) return rewriteMegaMenuForGuest(merged);
  return merged;
}
