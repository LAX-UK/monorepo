import "server-only";

import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import type { ArtistProfile } from "@/lib/data/contracts";
import { portraitForPublicArtist } from "@/lib/data/http/artist.server";
import { CATALOGUE_FETCH_POLICIES, catalogueFetch } from "@/lib/data/http/catalogue-fetch";
import { getServerApiBase } from "@/lib/data/http/hc-server";
import { getMarketingMegaMenuSections } from "@/lib/marketing/mega-menu-catalog";
import { rewriteMegaMenuForGuest } from "@/lib/marketing/mega-menu-href-rewrite";
import { artistPath } from "@/lib/seo/url";
import { cache } from "react";

async function fetchMenuArtists(): Promise<ArtistProfile[]> {
  if (process.env.NEXT_PUBLIC_ENABLE_ARTISTS === "false") return [];
  const res = await catalogueFetch(
    `${getServerApiBase()}/artists/public?limit=6&offset=0`,
    CATALOGUE_FETCH_POLICIES.megaMenu,
  );
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

/** Session-free mega menu for cacheable marketing chrome (guest dashboard href rewrite). */
export const loadCachedMegaMenuSections = cache(async (): Promise<MegaMenuSection[]> => {
  const base = getMarketingMegaMenuSections();
  if (process.env.NEXT_PUBLIC_ENABLE_ARTISTS === "false") {
    return rewriteMegaMenuForGuest(base);
  }
  try {
    const artists = await fetchMenuArtists();
    return rewriteMegaMenuForGuest(mergeArtistTeasersIntoSections(base, artists));
  } catch {
    return rewriteMegaMenuForGuest(base);
  }
});

/** @deprecated Prefer {@link loadCachedMegaMenuSections} — kept for callers that need session-aware hrefs. */
export async function loadMegaMenuSections(): Promise<MegaMenuSection[]> {
  return loadCachedMegaMenuSections();
}
