import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { type WatchedArtistVm, WatchingView } from "@/components/dashboard/watchlist/watching-view";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { resolveArtistFollowProfiles } from "@/lib/data/artist-follow-profiles.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerMySavedSearches } from "@/lib/data/http/saved-searches.server";
import { resolveSaleTitles } from "@/lib/data/sale-titles.server";
import { artistPath } from "@/lib/seo/url";
import { buildWatchedLots, parseWatchingView } from "@/lib/watching/watching.vm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Watching" };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function settle<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

/** The person's watched lots, with where they stand on each; `null` when they could not be read. */
async function loadLots() {
  const c = await getServerDataContainer();
  const [rows, bids, user] = await Promise.all([
    settle(() => c.watchlist.listMine({ sort: "endingSoon", categoryIds: [] })),
    settle(() => c.buying.bids()),
    settle(() => c.session.getCurrent()),
  ]);
  if (!rows) return null;
  return buildWatchedLots({
    rows,
    // Bids only add the person's standing; the list works without them.
    bids: bids ?? [],
    userId: user?.id,
    saleTitleById: await resolveSaleTitles(rows.map((row) => row.lot?.saleId)),
  });
}

/** The artists the person follows, with each alert; `null` when they could not be read. */
async function loadArtists(): Promise<WatchedArtistVm[] | null> {
  const c = await getServerDataContainer();
  const rows = await settle(() => c.artistFollow.listMine());
  if (!rows) return null;
  const profiles = await resolveArtistFollowProfiles(rows);
  return profiles
    .map((profile) => ({
      artistId: profile.artistId,
      name: profile.displayName,
      href: artistPath({ id: profile.artistId, name: profile.displayName }),
      portraitUrl: profile.portraitUrl,
      alert: rows.find((row) => row.artistId === profile.artistId)?.alert ?? {
        medium: null,
        priceMin: null,
        priceMax: null,
      },
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Watching: lots, artists and saved searches on one page. The lists are the person's own, even
 * while they act for an organisation, and the page says so.
 */
export default async function WatchingPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const c = await getServerDataContainer();
  const [scope, lots, artists, searches] = await Promise.all([
    c.buying.scope(),
    loadLots(),
    loadArtists(),
    settle(getServerMySavedSearches),
  ]);
  const organisation = scope.account.kind === "organisation" ? scope.account.name : null;
  return (
    <DashboardListPage
      title="Watching"
      description="Lots, artists and searches you follow, and what we tell you about them."
    >
      <SetMobileShellTitle title="Watching" />
      <WatchingView
        // `section=artists` is the old address of the artists list.
        view={parseWatchingView(sp.tab ?? (sp.section === "artists" ? "artists" : undefined))}
        lots={lots}
        artists={artists}
        searches={searches}
        organisation={organisation}
      />
    </DashboardListPage>
  );
}
