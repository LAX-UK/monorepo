"use client";

import { MediaImage } from "@/components/ui/media-image";
import { ListEmpty, ListLoadError, ListNoResults } from "@/components/workspace/list-states";
import { useListQuery } from "@/components/workspace/use-list-query";
import { defaultArtistWatchlistClient } from "@/lib/data/http/artist-watchlist.client";
import type { SavedSearchRow } from "@/lib/data/http/saved-searches.client";
import { deleteSavedSearch } from "@/lib/data/http/saved-searches.client";
import { removeWatchlistLot } from "@/lib/data/http/watchlist.client";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { notify } from "@/lib/ui/notify";
import { type TopicReach, type WatchingAlertReach, reachLabel } from "@/lib/watching/alert-reach";
import { artistAlertSummary } from "@/lib/watching/artist-alert";
import {
  type AlertAccess,
  needsOthersConfirmation,
  switchSearchEmail,
  turnedOnMessage,
} from "@/lib/watching/search-email";
import { reminderRowLabel } from "@/lib/watching/watched-lot-reminder.vm";
import { parseWatchingListQuery, watchingListSearch } from "@/lib/watching/watching-list-query";
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
import { lotCardMediaFrame } from "@auction/marketing-ui/lot-media/lot-card-media-frame";
import { InlineActionMenu } from "@auction/ui/components/inline-action-menu";
import { RecordList, RecordRow, RecordRowMedia } from "@auction/ui/components/record-row";
import { Button } from "@auction/ui/lax/button";
import { ButtonLink } from "@auction/ui/lax/button-link";
import { ListToolbar, ShowingCount, SortMenu } from "@auction/ui/lax/list-toolbar";
import { StatusBadge } from "@auction/ui/lax/status-badge";
import type { TabNavItem } from "@auction/ui/lax/tabs";
import { cn } from "@auction/ui/lib/utils";
import { Lock, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertReachNote } from "./alert-reach-note";
import { ArtistAlertDialog } from "./artist-alert-dialog";
import { LotReminderDialog } from "./lot-reminder-dialog";
import { TurnOnEmailDialog } from "./turn-on-email-dialog";
import { SearchesList } from "./watching-searches-list";

export type WatchedArtistVm = {
  artistId: string;
  name: string;
  href: string;
  portraitUrl: string | null;
  alert: ArtistAlertCriteria;
};

export type WatchingViewProps = {
  /** Each list is `null` when it could not be read. */
  lots: WatchedLotRowVm[] | null;
  artists: WatchedArtistVm[] | null;
  searches: SavedSearchRow[] | null;
  /** Where artist and search alerts reach the person; null when it could not be read. */
  reach: WatchingAlertReach;
  /** Whether email can be switched on from here, or alerts are stopped or the address unverified. */
  emailAccess: AlertAccess;
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
export function WatchingView({
  lots,
  artists,
  searches,
  reach,
  emailAccess,
  organisation,
}: WatchingViewProps) {
  const router = useRouter();
  // Search and order live in the address: Back from a lot returns to the same filtered list.
  // The address itself seeds the query (Back can hand the page the server props it was first
  // built from, without the search); it is re-seeded only when the view changes.
  const urlQuery = parseWatchingListQuery(Object.fromEntries(useSearchParams()));
  const [seed, setSeed] = useState(urlQuery);
  if (seed.view !== urlQuery.view) setSeed(urlQuery);
  const view = seed.view;
  const {
    query: listQuery,
    setQuery: setListQuery,
    search,
    setSearch,
  } = useListQuery(seed, watchingListSearch);
  const query = listQuery.q;
  const sort = listQuery.sort;
  const setSort = (next: WatchedLotSort) => setListQuery({ ...listQuery, sort: next });
  const [editing, setEditing] = useState<WatchedArtistVm | null>(null);
  const [reminding, setReminding] = useState<WatchedLotRowVm | null>(null);
  const [confirming, setConfirming] = useState<SavedSearchRow | null>(null);
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
  const topicEmailOn = reach?.searches.emailOn ?? null;
  const othersOn = (search: SavedSearchRow) =>
    (searches ?? []).filter((other) => other.id !== search.id && other.notifyEmail).length;
  const runSearchEmail = (search: SavedSearchRow, on: boolean) =>
    start(async () => {
      const result = await switchSearchEmail({
        id: search.id,
        on,
        previous: search.notifyEmail,
        access: emailAccess,
      });
      if (result.ok) {
        // Turning the topic back on brings back the others that already had their own switch on.
        const broughtBack = on && topicEmailOn === false ? othersOn(search) : 0;
        notify.success(on ? turnedOnMessage(broughtBack) : "Email alerts off for this search");
      } else notify.error("We couldn't save that change", { description: result.error });
      setConfirming(null);
      refresh();
    });
  /** Turning on asks first when it would also bring back other searches' email. */
  const setSearchEmail = (search: SavedSearchRow, on: boolean) => {
    if (on && needsOthersConfirmation({ topicEmailOn, othersOn: othersOn(search) })) {
      setConfirming(search);
      return;
    }
    runSearchEmail(search, on);
  };
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
          ? { search: { value: search, onValueChange: setSearch, placeholder: placeholder[view] } }
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
          onClear={() => setListQuery({ ...listQuery, q: "" })}
          onStop={stopWatching}
          onRemind={setReminding}
        />
      ) : null}
      {view === "artists" ? (
        <ArtistsList
          artists={artists}
          reach={reach?.artists ?? null}
          query={query}
          onClear={() => setListQuery({ ...listQuery, q: "" })}
          onEdit={setEditing}
          onUnfollow={unfollow}
        />
      ) : null}
      {view === "searches" ? (
        <SearchesList
          searches={searches}
          reach={reach?.searches ?? null}
          query={query}
          onClear={() => setListQuery({ ...listQuery, q: "" })}
          onRemove={removeSearch}
          onEmail={setSearchEmail}
          access={emailAccess}
          busy={busy}
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
      <TurnOnEmailDialog
        open={confirming !== null}
        othersOn={confirming ? othersOn(confirming) : 0}
        busy={busy}
        onConfirm={() => confirming && runSearchEmail(confirming, true)}
        onCancel={() => setConfirming(null)}
      />
      <LotReminderDialog
        lot={reminding}
        onOpenChange={(open) => {
          if (!open) setReminding(null);
        }}
        onSaved={refresh}
      />
    </div>
  );
}

/** The lot's picture as its department shows it: whole where the style does, filling where not. */
function WatchedLotThumb({ lot }: { lot: WatchedLotRowVm }) {
  const frame = lotCardMediaFrame(lot.displayStyle);
  return (
    <RecordRowMedia>
      <span className={cn("block size-full", frame.inset)}>
        <span
          className={cn(
            "relative block size-full",
            frame.fit === "contain" ? "[&_img]:!object-contain" : "[&_img]:!object-cover",
          )}
        >
          <MediaImage src={lot.image} alt="" sizes="48px" />
        </span>
      </span>
    </RecordRowMedia>
  );
}

function LotsList({
  lots,
  query,
  sort,
  onClear,
  onStop,
  onRemind,
}: {
  lots: WatchedLotRowVm[] | null;
  query: string;
  sort: WatchedLotSort;
  onClear: () => void;
  onStop: (lot: WatchedLotRowVm) => void;
  onRemind: (lot: WatchedLotRowVm) => void;
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
            leading={<WatchedLotThumb lot={lot} />}
            title={lot.title}
            meta={[lot.lotLabel, lot.saleTitle, lot.moment, reminderRowLabel(lot.reminder)]}
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
                  ...(lot.ended
                    ? []
                    : [
                        {
                          type: "item" as const,
                          label: lot.reminder ? "Change reminder or note" : "Set reminder or note",
                          onSelect: () => onRemind(lot),
                        },
                      ]),
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
  reach,
  query,
  onClear,
  onEdit,
  onUnfollow,
}: {
  artists: WatchedArtistVm[] | null;
  reach: TopicReach | null;
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
    <>
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
            meta={[artistAlertSummary(artist.alert), ...(reach ? [reachLabel(reach)] : [])]}
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
      <AlertReachNote />
    </>
  );
}
