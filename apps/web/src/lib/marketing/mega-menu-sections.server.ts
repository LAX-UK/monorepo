import "server-only";

import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import type { ArtistProfile } from "@/lib/data/contracts";
import { mapPublicUserToArtist } from "@/lib/data/http/artist.server";
import { getServerApiBase } from "@/lib/data/http/hc-server";
import { getMarketingMegaMenuSections } from "@/lib/marketing/mega-menu-catalog";
import { artistPath } from "@/lib/seo/url";

async function fetchMenuArtists(): Promise<ArtistProfile[]> {
  if (process.env.NEXT_PUBLIC_ENABLE_ARTISTS === "false") return [];
  const res = await fetch(`${getServerApiBase()}/users/public/artists?limit=6&offset=0`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const body = (await res.json()) as {
    data: { id: string; name: string; image?: string | null }[];
  };
  return body.data.map(mapPublicUserToArtist);
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

export async function loadMegaMenuSections(): Promise<MegaMenuSection[]> {
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
}
