"use client";

import { MediaImage } from "@/components/ui/media-image";
import { ListEmpty, ListLoadError, ListNoResults } from "@/components/workspace/list-states";
import { defaultArtistWatchlistClient } from "@/lib/data/http/artist-watchlist.client";
import type { SavedSearchRow } from "@/lib/data/http/saved-searches.client";
import { deleteSavedSearch } from "@/lib/data/http/saved-searches.client";
import { removeWatchlistLot } from "@/lib/data/http/watchlist.client";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { notify } from "@/lib/ui/notify";
import { artistAlertSummary } from "@/lib/watching/artist-alert";
import { savedSearchHref, savedSearchSummary } from "@/lib/watching/saved-search";
import {
  WATCHED_LOT_SORTS,
  WATCHED_LOT_SORT_LABEL,
  WATCHING_VIEWS,
  WATCHING_VIEW_LABEL,
  type WatchedLotRowVm,
  type WatchedLotSort,
  type WatchingView as WatchingViewId,
  watchedLotsInView,
} from "@/lib/watching/watching.vm";
import { matchesEveryWord } from "@/lib/workspace/list-search";
import type { ArtistAlertCriteria } from "@auction/domain";
import { InlineActionMenu, RecordList, RecordRow, RecordRowMedia } from "@auction/ui";
import {
  Button,
  ButtonLink,
  ListToolbar,
  ShowingCount,
  SortMenu,
  StatusBadge,
  type TabNavItem,
} from "@auction/ui/lax";
import { Lock, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArtistAlertDialog } from "./artist-alert-dialog";

export type WatchedArtistVm = {
  artistId: string;
  name: string;
  href: string;
  portraitUrl: string | null;
  alert: ArtistAlertCriteria;
};

export type WatchingViewProps = {
  view: WatchingViewId;
  /** Each list is `null` when it could not be read. */
  lots: WatchedLotRowVm[] | null;
  artists: WatchedArtistVm[] | null;
  searches: SavedSearchRow[] | null;
  /** The organisation the person acts for: the list is theirs alone, and says so. */
  organisation: string | null;
};

const BROWSE = calendarSalesHref({ tab: "upcoming" });

function tabHref(view: WatchingViewId): string {
  return view === "lots" ? CLIENT_ROUTES.watching : `${CLIENT_ROUTES.watching}?tab=${view}`;
}

/**
 * Watching: the lots, artists and searches the person follows, each a view with its count. The
 * alert on an artist is edited here; how alerts reach the person stays in Bid settings.
 */
export function WatchingView({ view, lots, artists, searches, organisation }: WatchingViewProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<WatchedLotSort>("closing");
  const [editing, setEditing] = useState<WatchedArtistVm | null>(null);
  const [busy, start] = useTransition();
  const counts: Record<WatchingViewId, number | undefined> = {
    lots: lots?.length,
    artists: artists?.length,
    searches: searches?.length,
  };
  const tabs: TabNavItem[] = WATCHING_VIEWS.map((id) => ({
    id,
    label: WATCHING_VIEW_LABEL[id],
    href: tabHref(id),
    ...(counts[id] === undefined ? {} : { count: counts[id] }),
  }));
  const ended = (lots ?? []).filter((lot) => lot.ended);
  const refresh = () => router.refresh();

  const clearEnded = () =>
    start(async () => {
      const results = await Promise.all(ended.map((lot) => removeWatchlistLot(lot.lotId)));
      const removed = results.filter(Boolean).length;
      if (removed === ended.length)
        notify.success(`${removed === 1 ? "1 ended lot" : `${removed} ended lots`} removed`);
      else notify.error("Some ended lots couldn't be removed. Try again in a moment.");
      refresh();
    });
  const stopWatching = (lot: WatchedLotRowVm) =>
    start(async () => {
      if (await removeWatchlistLot(lot.lotId)) notify.success(`Stopped watching ${lot.title}`);
      else notify.error("We couldn't stop watching that lot. Try again in a moment.");
      refresh();
    });
  const unfollow = (artist: WatchedArtistVm) =>
    start(async () => {
      if (await defaultArtistWatchlistClient.unfollow(artist.artistId)) {
        notify.success(`Stopped following ${artist.name}`);
      } else notify.error("We couldn't stop following that artist. Try again in a moment.");
      refresh();
    });
  const removeSearch = (search: SavedSearchRow) =>
    start(async () => {
      if (await deleteSavedSearch(search.id)) notify.success("Saved search removed");
      else notify.error("We couldn't remove that search. Try again in a moment.");
      refresh();
    });

  const placeholder: Record<WatchingViewId, string> = {
    lots: "Search watched lots",
    artists: "Search artists",
    searches: "Search saved searches",
  };

  return (
    <div className="flex flex-col gap-4">
      <ListToolbar
        tabs={{ items: tabs, activeId: view, label: "Watching", Link }}
        {...(counts[view]
          ? { search: { value: query, onValueChange: setQuery, placeholder: placeholder[view] } }
          : {})}
        {...(view === "lots" && counts.lots
          ? {
              sort: (
                <>
                  <SortMenu<WatchedLotSort>
                    value={sort}
                    onValueChange={setSort}
                    options={WATCHED_LOT_SORTS.map((value) => ({
                      value,
                      label: WATCHED_LOT_SORT_LABEL[value],
                    }))}
                  />
                  {ended.length > 0 ? (
                    <Button variant="ghost" loading={busy} onClick={clearEnded}>
                      Clear ended
                    </Button>
                  ) : null}
                </>
              ),
            }
          : {})}
      />
      {organisation ? (
        <p className="flex items-center gap-2 text-lax-13 text-lax-muted">
          <Lock aria-hidden className="size-3.5 shrink-0" />
          Only you see this list. It isn't shared with {organisation}.
        </p>
      ) : null}
      {view === "lots" ? (
        <LotsList
          lots={lots}
          query={query}
          sort={sort}
          onClear={() => setQuery("")}
          onStop={stopWatching}
        />
      ) : null}
      {view === "artists" ? (
        <ArtistsList
          artists={artists}
          query={query}
          onClear={() => setQuery("")}
          onEdit={setEditing}
          onUnfollow={unfollow}
        />
      ) : null}
      {view === "searches" ? (
        <SearchesList
          searches={searches}
          query={query}
          onClear={() => setQuery("")}
          onRemove={removeSearch}
        />
      ) : null}
      <ArtistAlertDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        artist={editing ? { id: editing.artistId, name: editing.name, alert: editing.alert } : null}
        onSaved={refresh}
      />
    </div>
  );
}

function LotsList({
  lots,
  query,
  sort,
  onClear,
  onStop,
}: {
  lots: WatchedLotRowVm[] | null;
  query: string;
  sort: WatchedLotSort;
  onClear: () => void;
  onStop: (lot: WatchedLotRowVm) => void;
}) {
  if (!lots) return <ListLoadError />;
  if (lots.length === 0) {
    return (
      <ListEmpty
        illustration="plinth"
        title="Nothing watched yet"
        description="Watch a lot to follow it here and get a reminder before it closes."
        actions={
          <ButtonLink href={BROWSE} Link={Link}>
            Browse upcoming sales
          </ButtonLink>
        }
      />
    );
  }
  const rows = watchedLotsInView(lots, query, sort);
  if (rows.length === 0) return <ListNoResults query={query} onClear={onClear} />;
  return (
    <>
      <RecordList aria-label="Watched lots">
        {rows.map((lot) => (
          <RecordRow
            key={lot.lotId}
            aria-label={`${lot.title}, ${lot.standing.label}`}
            href={lot.href}
            linkAs={Link}
            leading={
              <RecordRowMedia>
                <MediaImage src={lot.image} alt="" sizes="48px" />
              </RecordRowMedia>
            }
            title={lot.title}
            meta={[lot.lotLabel, lot.saleTitle, lot.moment]}
            figures={[lot.figure]}
            aligned
            status={
              <StatusBadge tone={lot.standing.tone} shape={lot.standing.shape}>
                {lot.standing.label}
              </StatusBadge>
            }
            menu={
              <InlineActionMenu
                label={`More for ${lot.title}`}
                items={[
                  {
                    type: "item",
                    label: "View lot",
                    onSelect: () => window.location.assign(lot.href),
                  },
                  { type: "separator" },
                  {
                    type: "item",
                    label: "Stop watching",
                    destructive: true,
                    onSelect: () => onStop(lot),
                  },
                ]}
              />
            }
          />
        ))}
      </RecordList>
      <ShowingCount shown={rows.length} total={rows.length} />
    </>
  );
}

function ArtistsList({
  artists,
  query,
  onClear,
  onEdit,
  onUnfollow,
}: {
  artists: WatchedArtistVm[] | null;
  query: string;
  onClear: () => void;
  onEdit: (artist: WatchedArtistVm) => void;
  onUnfollow: (artist: WatchedArtistVm) => void;
}) {
  if (!artists) return <ListLoadError />;
  if (artists.length === 0) {
    return (
      <ListEmpty
        illustration="easel"
        title="No artists followed"
        description="Follow an artist from their page to hear when their work comes up for sale."
        actions={
          <ButtonLink href="/artists" Link={Link}>
            Browse artists
          </ButtonLink>
        }
      />
    );
  }
  const rows = artists.filter((artist) => matchesEveryWord([artist.name], query));
  if (rows.length === 0) return <ListNoResults query={query} onClear={onClear} />;
  return (
    <RecordList aria-label="Artists you follow">
      {rows.map((artist) => (
        <RecordRow
          key={artist.artistId}
          href={artist.href}
          linkAs={Link}
          leading={
            <RecordRowMedia className="grid place-items-center rounded-full after:rounded-full">
              {artist.portraitUrl ? (
                <MediaImage src={artist.portraitUrl} alt="" sizes="48px" />
              ) : (
                <UserRound aria-hidden className="size-5 text-lax-muted" strokeWidth={1.5} />
              )}
            </RecordRowMedia>
          }
          title={artist.name}
          meta={[`Alert: ${artistAlertSummary(artist.alert)}`]}
          action={
            <Button
              size="sm"
              onClick={() => onEdit(artist)}
              aria-label={`Edit alert for ${artist.name}`}
            >
              Edit alert
            </Button>
          }
          menu={
            <InlineActionMenu
              label={`More for ${artist.name}`}
              items={[
                { type: "item", label: "Edit alert", onSelect: () => onEdit(artist) },
                { type: "separator" },
                {
                  type: "item",
                  label: "Stop following",
                  destructive: true,
                  onSelect: () => onUnfollow(artist),
                },
              ]}
            />
          }
        />
      ))}
    </RecordList>
  );
}

function SearchesList({
  searches,
  query,
  onClear,
  onRemove,
}: {
  searches: SavedSearchRow[] | null;
  query: string;
  onClear: () => void;
  onRemove: (search: SavedSearchRow) => void;
}) {
  if (!searches) return <ListLoadError />;
  if (searches.length === 0) {
    return (
      <ListEmpty
        illustration="search"
        title="No saved searches"
        description="Save a search in the catalogue to hear when new lots match it."
        actions={
          <ButtonLink href="/search" Link={Link}>
            Search the catalogue
          </ButtonLink>
        }
      />
    );
  }
  const rows = searches.filter((search) =>
    matchesEveryWord([search.label, savedSearchSummary(search.query)], query),
  );
  if (rows.length === 0) return <ListNoResults query={query} onClear={onClear} />;
  return (
    <RecordList aria-label="Saved searches">
      {rows.map((search) => (
        <RecordRow
          key={search.id}
          href={savedSearchHref(search.query)}
          linkAs={Link}
          leading={
            <RecordRowMedia className="grid place-items-center">
              <Search aria-hidden className="size-5 text-lax-muted" strokeWidth={1.5} />
            </RecordRowMedia>
          }
          title={search.label}
          meta={[
            savedSearchSummary(search.query),
            search.notifyEmail ? "email alerts on" : "no email alerts",
          ]}
          menu={
            <InlineActionMenu
              label={`More for ${search.label}`}
              items={[
                {
                  type: "item",
                  label: "Run search",
                  onSelect: () => window.location.assign(savedSearchHref(search.query)),
                },
                { type: "separator" },
                {
                  type: "item",
                  label: "Remove",
                  destructive: true,
                  onSelect: () => onRemove(search),
                },
              ]}
            />
          }
        />
      ))}
    </RecordList>
  );
}
