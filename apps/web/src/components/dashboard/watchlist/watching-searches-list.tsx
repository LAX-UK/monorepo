"use client";

import { ListEmpty, ListLoadError, ListNoResults } from "@/components/workspace/list-states";
import type { SavedSearchRow } from "@/lib/data/http/saved-searches.client";
import { type TopicReach, searchReachLabel } from "@/lib/watching/alert-reach";
import { savedSearchHref, savedSearchSummary } from "@/lib/watching/saved-search";
import {
  type AlertAccess,
  type SearchEmailControl,
  searchEmailControl,
} from "@/lib/watching/search-email";
import { matchesEveryWord } from "@/lib/workspace/list-search";
import { InlineActionMenu } from "@auction/ui/components/inline-action-menu";
import { RecordList, RecordRow, RecordRowMedia } from "@auction/ui/components/record-row";
import { ButtonLink } from "@auction/ui/lax/button-link";
import { Switch } from "@auction/ui/lax/switch";
import { Search } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { HeldOffSwitch } from "../settings/held-off-switch";
import { AlertReachNote } from "./alert-reach-note";

export function SearchesList({
  searches,
  reach,
  query,
  onClear,
  onRemove,
  onEmail,
  access,
  busy,
}: {
  searches: SavedSearchRow[] | null;
  reach: TopicReach | null;
  query: string;
  onClear: () => void;
  onRemove: (search: SavedSearchRow) => void;
  onEmail: (search: SavedSearchRow, on: boolean) => void;
  access: AlertAccess;
  busy: boolean;
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
  const controlFor = (search: SavedSearchRow) =>
    searchEmailControl({
      access,
      notifyEmail: search.notifyEmail,
      topicEmailOn: reach?.emailOn ?? null,
    });
  /** The row menu's email item shares the switch's state: held rows lead to where it is fixed. */
  const emailMenuItem = (search: SavedSearchRow) => {
    const control = controlFor(search);
    if (control.kind === "held") {
      return {
        type: "item" as const,
        label: "Turn on email",
        onSelect: () => window.location.assign(control.action.href),
      };
    }
    return {
      type: "item" as const,
      label: control.checked ? "Turn off email" : "Turn on email",
      onSelect: () => onEmail(search, !control.checked),
    };
  };
  const rows = searches.filter((search) =>
    matchesEveryWord([search.label, savedSearchSummary(search.query)], query),
  );
  if (rows.length === 0) return <ListNoResults query={query} onClear={onClear} />;
  return (
    <>
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
              searchReachLabel(search.notifyEmail, reach),
            ].filter((part): part is string => part !== null)}
            action={
              <SearchEmailAction
                search={search}
                control={controlFor(search)}
                busy={busy}
                onEmail={onEmail}
              />
            }
            menu={
              <InlineActionMenu
                label={`More for ${search.label}`}
                items={[
                  {
                    type: "item",
                    label: "Run search",
                    onSelect: () => window.location.assign(savedSearchHref(search.query)),
                  },
                  emailMenuItem(search),
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
      <AlertReachNote />
    </>
  );
}

/** A saved search's email control: a switch, or the held switch with where to put it right. */
function SearchEmailAction({
  search,
  control,
  busy,
  onEmail,
}: {
  search: SavedSearchRow;
  control: SearchEmailControl;
  busy: boolean;
  onEmail: (search: SavedSearchRow, on: boolean) => void;
}) {
  const descriptionId = useId();
  const label = `Email alerts for ${search.label}`;
  if (control.kind === "held") {
    return (
      <span className="flex items-center gap-2">
        <HeldOffSwitch label={label} reason={control.reason} />
        <ButtonLink Link={Link} size="sm" variant="ghost" href={control.action.href}>
          {control.action.label}
        </ButtonLink>
      </span>
    );
  }
  return (
    <>
      <Switch
        aria-label={label}
        checked={control.checked}
        disabled={busy}
        onCheckedChange={(on) => onEmail(search, on === true)}
        {...(control.description ? { "aria-describedby": descriptionId } : {})}
      />
      {control.description ? (
        <span id={descriptionId} className="sr-only">
          {control.description}
        </span>
      ) : null}
    </>
  );
}
