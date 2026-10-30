"use client";

import { ArrowDown, ArrowUp, Loader2, X } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "./command.js";
import { StatusBadge } from "./status-badge.js";

const SEARCH_DEBOUNCE_MS = 250;

export type RelationItem = {
  id: string;
  title: string;
  /** A second line under the title, such as an artist name or a date range. */
  subtitle?: string | null;
  thumbnailUrl?: string | null;
  /** True when the record is not visible on the public site yet. */
  draft?: boolean;
};

export type RelationSearchPage<T extends RelationItem> = {
  items: T[];
  /** Pass back to `search` for the next page, or null when there are no more. */
  nextCursor: string | null;
};

export type RelationPickerProps<T extends RelationItem> = {
  /** Names the picker for assistive technology, e.g. "Artworks in this exhibition". */
  label: string;
  items: T[];
  onChange: (next: T[]) => void;
  /**
   * Looks up candidates. Called after a pause in typing; `signal` aborts when a newer search
   * replaces this one, so implementations should pass it to `fetch`.
   */
  search: (
    query: string,
    cursor: string | null,
    signal: AbortSignal,
  ) => Promise<RelationSearchPage<T>>;
  /** False hides the reorder controls, for sets whose order is not stored. */
  ordered?: boolean;
  disabled?: boolean;
  /** Shown when nothing is linked yet. */
  emptyText?: string;
  className?: string;
};

type MoveControl = "up" | "down" | "position";
type PendingFocus = { id: string; control: MoveControl } | { id: null; control: "search" };

/** Returns a copy with the item at `from` moved to index `to`. */
function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}

function Thumbnail({ url }: { url: string | null | undefined }) {
  return url ? (
    <img
      src={url}
      alt=""
      className="size-12 shrink-0 rounded-sm bg-surface-container object-cover"
    />
  ) : (
    <span aria-hidden className="size-12 shrink-0 rounded-sm bg-surface-container" />
  );
}

function ItemSummary({ item }: { item: RelationItem }) {
  return (
    <>
      <Thumbnail url={item.thumbnailUrl} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-on-surface">{item.title}</span>
        {item.subtitle ? (
          <span className="block truncate text-xs text-on-surface-variant">{item.subtitle}</span>
        ) : null}
      </span>
      {item.draft ? <StatusBadge tone="warning">Draft</StatusBadge> : null}
    </>
  );
}

function useCandidateSearch<T extends RelationItem>(
  search: RelationPickerProps<T>["search"],
  query: string,
  active: boolean,
) {
  const [results, setResults] = React.useState<T[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const inFlight = React.useRef<AbortController | null>(null);
  const searchRef = React.useRef(search);
  searchRef.current = search;

  const run = React.useCallback(async (q: string, cursor: string | null) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setLoading(true);
    setFailed(false);
    try {
      const page = await searchRef.current(q, cursor, controller.signal);
      if (controller.signal.aborted) return;
      setResults((previous) => (cursor ? [...previous, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
    } catch {
      if (controller.signal.aborted) return;
      setFailed(true);
      if (!cursor) setResults([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!active) return;
    setLoading(true);
    const handle = setTimeout(() => void run(query.trim(), null), SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(handle);
      inFlight.current?.abort();
    };
  }, [active, query, run]);

  const loadMore = React.useCallback(() => {
    if (nextCursor) void run(query.trim(), nextCursor);
  }, [nextCursor, query, run]);

  return { results, nextCursor, loading, failed, loadMore };
}

/**
 * A searchable multi-select with an ordered list of what has been chosen. The component holds no
 * data of its own: the caller owns `items` and supplies `search`.
 *
 * Reordering uses buttons and a position menu rather than dragging, so it works for keyboard,
 * switch and touch users (WCAG 2.2 SC 2.5.7). Every change is announced in a polite live region.
 */
export function RelationPicker<T extends RelationItem>({
  label,
  items,
  onChange,
  search,
  ordered = true,
  disabled = false,
  emptyText = "Nothing linked yet.",
  className,
}: RelationPickerProps<T>) {
  const baseId = React.useId();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [announcement, setAnnouncement] = React.useState("");
  const [pendingFocus, setPendingFocus] = React.useState<PendingFocus | null>(null);
  const { results, nextCursor, loading, failed, loadMore } = useCandidateSearch(
    search,
    query,
    open,
  );

  const linkedIds = React.useMemo(() => new Set(items.map((item) => item.id)), [items]);

  // Focus is restored once the reordered rows have rendered: a node React moves can lose it, and
  // a button that became disabled (first row's "up") cannot keep it.
  React.useLayoutEffect(() => {
    if (!pendingFocus) return;
    setPendingFocus(null);
    if (pendingFocus.id === null) {
      inputRef.current?.focus();
      return;
    }
    const row = containerRef.current?.querySelector(`[data-item-id="${pendingFocus.id}"]`);
    const usable = (control: string) => {
      const node = row?.querySelector<HTMLButtonElement | HTMLSelectElement>(
        `[data-control="${control}"]`,
      );
      return node && !node.disabled ? node : null;
    };
    const target = [pendingFocus.control, "position", "down", "up", "remove"]
      .map(usable)
      .find((node) => node);
    target?.focus();
  }, [pendingFocus]);

  function add(item: T) {
    if (linkedIds.has(item.id)) return;
    onChange([...items, item]);
    setAnnouncement(`Added ${item.title}. ${items.length + 1} linked.`);
  }

  function move(index: number, to: number, control: MoveControl) {
    const item = items[index];
    if (!item || to < 0 || to >= items.length || to === index) return;
    onChange(moveItem(items, index, to));
    setAnnouncement(`Moved ${item.title} to position ${to + 1} of ${items.length}`);
    setPendingFocus({ id: item.id, control });
  }

  function remove(index: number) {
    const item = items[index];
    if (!item) return;
    onChange(items.filter((_, i) => i !== index));
    const neighbour = items[index + 1] ?? items[index - 1];
    setAnnouncement(`Removed ${item.title}. ${items.length - 1} linked.`);
    setPendingFocus(
      neighbour ? { id: neighbour.id, control: "position" } : { id: null, control: "search" },
    );
  }

  const listId = `${baseId}-results`;
  const rowButton = "min-h-11 min-w-11 px-0";

  return (
    <div ref={containerRef} className={cn("space-y-3", className)}>
      {/* biome-ignore lint/a11y/useSemanticElements: <output> is not announced consistently */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <Command
        shouldFilter={false}
        label={`Search to add: ${label}`}
        className="overflow-visible rounded-md border border-outline-variant/40 bg-surface-container-lowest"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.stopPropagation();
            setOpen(false);
          }
        }}
      >
        <CommandInput
          ref={inputRef}
          aria-controls={listId}
          placeholder="Search to add…"
          value={query}
          disabled={disabled}
          onValueChange={(value) => {
            setQuery(value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {open ? (
          <CommandList id={listId} className="max-h-72 border-t border-outline-variant/40">
            {failed ? (
              <p role="alert" className="px-3 py-3 text-sm text-error">
                Search failed. Try again.
              </p>
            ) : null}
            {!loading && !failed && results.length === 0 ? (
              <CommandEmpty>No matches.</CommandEmpty>
            ) : null}
            {results.map((candidate) => {
              const linked = linkedIds.has(candidate.id);
              return (
                <CommandItem
                  key={candidate.id}
                  value={candidate.id}
                  disabled={linked}
                  onSelect={() => add(candidate)}
                  className="gap-3 py-2"
                >
                  <ItemSummary item={candidate} />
                  {linked ? (
                    <span className="shrink-0 text-xs text-on-surface-variant">Added</span>
                  ) : null}
                </CommandItem>
              );
            })}
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-on-surface-variant">
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                Searching…
              </div>
            ) : null}
            {nextCursor && !loading ? (
              <div className="p-2">
                <Button type="button" variant="outline" size="default" onClick={loadMore}>
                  Show more results
                </Button>
              </div>
            ) : null}
          </CommandList>
        ) : null}
      </Command>

      {items.length === 0 ? (
        <p className="text-sm text-on-surface-variant">{emptyText}</p>
      ) : (
        <ol aria-label={label} className="space-y-2">
          {items.map((item, index) => (
            <li
              key={item.id}
              data-item-id={item.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-outline-variant/40 bg-surface-container-lowest p-2"
            >
              {ordered ? (
                <span
                  aria-hidden
                  className="w-6 text-center text-sm tabular-nums text-on-surface-variant"
                >
                  {index + 1}
                </span>
              ) : null}
              <ItemSummary item={item} />
              <div className="flex flex-wrap items-center gap-1">
                {ordered ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={rowButton}
                      data-control="up"
                      aria-label={`Move ${item.title} up`}
                      disabled={disabled || index === 0}
                      onClick={() => move(index, index - 1, "up")}
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={rowButton}
                      data-control="down"
                      aria-label={`Move ${item.title} down`}
                      disabled={disabled || index === items.length - 1}
                      onClick={() => move(index, index + 1, "down")}
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </Button>
                    <select
                      data-control="position"
                      aria-label={`Move ${item.title} to position`}
                      value={index}
                      disabled={disabled || items.length < 2}
                      onChange={(event) => move(index, Number(event.target.value), "position")}
                      className="min-h-11 rounded-md border border-outline-variant bg-surface-container-lowest px-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                    >
                      {items.map((entry, position) => (
                        <option key={entry.id} value={position}>
                          {`Position ${position + 1}`}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={rowButton}
                  data-control="remove"
                  aria-label={`Remove ${item.title}`}
                  disabled={disabled}
                  onClick={() => remove(index)}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
