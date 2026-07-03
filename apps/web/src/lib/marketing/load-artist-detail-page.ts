import "server-only";

import { loadRelatedDirectoryArtists } from "@/lib/artists/related-directory-artists.server";
import { getServerMyArtistWatchIds } from "@/lib/data/http/artist-watchlist.server";
import { fetchPublicArtistAliases, fetchRegistryArtistById } from "@/lib/data/http/artist.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import {
  buildArtistPageJsonLd,
  ensureCanonicalArtistSlug,
  shouldNoIndexArtist,
} from "@/lib/marketing/artist-page.seo";
import { buildArtistPageVM } from "@/lib/marketing/artist-page.vm";
import type { Lot } from "@auction/types";
import { notFound } from "next/navigation";

async function loadArtistLots(artistId: string): Promise<Lot[]> {
  const auctionReader = await getServerLotReader();
  try {
    const [active, scheduled, ended] = await Promise.all([
      auctionReader.list({
        artistId,
        status: "active",
        limit: 24,
        offset: 0,
        sort: "endingAsc",
      }),
      auctionReader.list({
        artistId,
        status: "scheduled",
        limit: 24,
        offset: 0,
        sort: "endingAsc",
      }),
      auctionReader.list({
        artistId,
        status: "ended",
        limit: 24,
        offset: 0,
        sort: "endedDesc",
      }),
    ]);
    return [...active, ...scheduled, ...ended];
  } catch {
    return [];
  }
}

export type ArtistDetailPageData = {
  vm: ReturnType<typeof buildArtistPageVM>;
  jsonLdText: string;
  noIndex: boolean;
};

export async function loadArtistDetailPage(input: {
  id: string;
  slug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ArtistDetailPageData> {
  const { id, slug, searchParams } = input;
  const [artistLots, registry, aliases, session, watchedArtistIds] = await Promise.all([
    loadArtistLots(id),
    fetchRegistryArtistById(id),
    fetchPublicArtistAliases(id),
    getServerSessionUser(),
    getServerMyArtistWatchIds(),
  ]);
  if (!registry) notFound();

  ensureCanonicalArtistSlug(slug, { id: registry.id, name: registry.displayName });

  const relatedRows = await loadRelatedDirectoryArtists(id, registry);

  const vm = buildArtistPageVM({
    id,
    slug,
    searchParams,
    artistLots,
    registry,
    aliases,
    session,
    watchedArtistIds,
    relatedRows,
  });

  const jsonLdText = buildArtistPageJsonLd({
    artistName: vm.artistName,
    profilePath: vm.profilePath,
    profileUrl: vm.profileUrl,
    artistPortraitUrl: vm.artistPortraitUrl,
    artistTagline: vm.artistTagline,
    artistBio: vm.artistBio,
    registry,
    aliasesList: vm.aliasesList,
    artistLots,
  });

  return {
    vm,
    jsonLdText,
    noIndex: shouldNoIndexArtist(registry),
  };
}
