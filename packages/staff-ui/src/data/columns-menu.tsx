"use client";

import { Columns3 } from "lucide-react";
import * as React from "react";
import { StaffButton } from "../primitives/button.js";
import {
  StaffMenu,
  StaffMenuCheckboxItem,
  StaffMenuContent,
  StaffMenuItem,
  StaffMenuLabel,
  StaffMenuSeparator,
  StaffMenuTrigger,
} from "../primitives/menu.js";
import type { DataColumn } from "./types.js";

export type ColumnVisibility = {
  /** Ids of the columns the person has hidden. */
  hidden: ReadonlySet<string>;
  setHidden: (columnId: string, hidden: boolean) => void;
  /** Back to the list's own defaults. */
  reset: () => void;
  /** True when the choice differs from the defaults. */
  changed: boolean;
};

const storageKeyOf = (listKey: string) => `staff.columns.${listKey}`;

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>) {
  return a.size === b.size && [...a].every((value) => b.has(value));
}

/**
 * What is saved under `staff.columns.<listKey>`: the hidden columns, and every column the list
 * had when the choice was saved. A column missing from `known` was added to the list later, so
 * the person never chose about it and it takes the list's default.
 */
export type StoredColumnVisibility = { hidden: string[]; known: string[] };

export type ColumnVisibilityOptions = {
  /** Every column id the list has now. Saved as `known` with each choice. */
  columnIds?: readonly string[];
  /**
   * The list's column ids while it saved choices in the old plain-array form (see
   * `readStoredColumnVisibility`). Set it when a column was added after that; leave it out and
   * an old array is read against the list's current columns, exactly as before.
   */
  legacyColumnIds?: readonly string[];
};

const stringsOf = (value: unknown): string[] | null =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : null;

/**
 * Reads a saved choice. Two forms are accepted, so no saved choice is lost:
 *
 * - `{ hidden, known }`, written since columns record what they knew.
 * - A plain array of hidden ids, written before. It does not say which columns existed, so it is
 *   read as `known = legacyColumnIds` when the list gives them (the columns it had while it saved
 *   arrays), and otherwise as knowing every current column: the array then decides alone, which
 *   is how it was always read.
 *
 * Returns null for anything else (nothing saved, or unreadable).
 */
export function readStoredColumnVisibility(
  raw: string | null,
  legacyColumnIds?: readonly string[],
): { hidden: string[]; known: string[] | null } | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const legacy = stringsOf(parsed);
  if (legacy) return { hidden: legacy, known: legacyColumnIds ? [...legacyColumnIds] : null };
  if (parsed && typeof parsed === "object") {
    const hidden = stringsOf((parsed as { hidden?: unknown }).hidden);
    const known = stringsOf((parsed as { known?: unknown }).known);
    if (hidden && known) return { hidden, known };
  }
  return null;
}

/**
 * The hidden set a saved choice gives: what the person hid, plus each default-hidden column they
 * never saw (not in `known`). A default-visible column they never saw is simply not hidden.
 * `known: null` means the choice covers every column.
 */
export function resolveHiddenColumns(
  stored: { hidden: readonly string[]; known: readonly string[] | null },
  defaultHidden: readonly string[],
): Set<string> {
  const hidden = new Set(stored.hidden);
  if (stored.known) {
    const known = new Set(stored.known);
    for (const id of defaultHidden) if (!known.has(id)) hidden.add(id);
  }
  return hidden;
}

/**
 * Which of a list's columns are hidden, remembered per list in this browser. Starts from the
 * list's defaults (`defaultHidden`) so a lower-priority column can ship hidden. A column added
 * after the person saved a choice starts at its default, so a new default-hidden column stays
 * hidden for them too.
 */
export function useColumnVisibility(
  listKey: string,
  defaultHidden: readonly string[] = [],
  options: ColumnVisibilityOptions = {},
): ColumnVisibility {
  // Keyed by content, so an inline array does not reset the choice on every render.
  const defaultsKey = defaultHidden.join("\n");
  // biome-ignore lint/correctness/useExhaustiveDependencies: defaultsKey is the content of defaultHidden
  const defaults = React.useMemo(() => new Set(defaultHidden), [defaultsKey]);
  const columnIdsKey = options.columnIds?.join("\n") ?? null;
  const legacyKey = options.legacyColumnIds?.join("\n") ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: columnIdsKey is the content of columnIds
  const columnIds = React.useMemo(() => options.columnIds, [columnIdsKey]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: legacyKey is the content of legacyColumnIds
  const legacyColumnIds = React.useMemo(() => options.legacyColumnIds, [legacyKey]);
  const [hidden, setHiddenState] = React.useState<ReadonlySet<string>>(defaults);
  // Columns the saved choice already knew, kept so a save never forgets one.
  const knownRef = React.useRef<readonly string[]>([]);
  React.useEffect(() => {
    try {
      const stored = readStoredColumnVisibility(
        window.localStorage.getItem(storageKeyOf(listKey)),
        legacyColumnIds,
      );
      if (!stored) return;
      knownRef.current = stored.known ?? [];
      setHiddenState(resolveHiddenColumns(stored, [...defaults]));
    } catch {
      // Storage unavailable or unreadable: keep the defaults.
    }
  }, [listKey, defaults, legacyColumnIds]);
  const persist = React.useCallback(
    (next: ReadonlySet<string>) => {
      setHiddenState(next);
      try {
        if (sameSet(next, defaults)) {
          window.localStorage.removeItem(storageKeyOf(listKey));
          return;
        }
        // Every column on screen now, plus the defaults and anything hidden, so a column that is
        // only here on some pages still counts as chosen about.
        const known = new Set([...knownRef.current, ...(columnIds ?? []), ...defaults, ...next]);
        knownRef.current = [...known];
        const value: StoredColumnVisibility = { hidden: [...next], known: [...known] };
        window.localStorage.setItem(storageKeyOf(listKey), JSON.stringify(value));
      } catch {
        // Storage unavailable: the choice lasts for this page only.
      }
    },
    [listKey, defaults, columnIds],
  );
  const setHidden = React.useCallback(
    (columnId: string, hide: boolean) => {
      const next = new Set(hidden);
      if (hide) next.add(columnId);
      else next.delete(columnId);
      persist(next);
    },
    [hidden, persist],
  );
  const reset = React.useCallback(() => persist(defaults), [persist, defaults]);
  return { hidden, setHidden, reset, changed: !sameSet(hidden, defaults) };
}

/** The columns a list shows, given what the person has hidden. Locked columns always stay. */
export function visibleColumns<T>(
  columns: readonly DataColumn<T>[],
  hidden: ReadonlySet<string>,
  locked: readonly string[] = [],
): DataColumn<T>[] {
  const keep = new Set(locked);
  return columns.filter((column) => keep.has(column.id) || !hidden.has(column.id));
}

/**
 * "Columns": show or hide a list's columns, with "Reset columns". The identifying column (the
 * first) and any other `locked` column cannot be hidden; neither can the row actions.
 */
export function ColumnsMenu<T>({
  columns,
  visibility,
  locked,
}: {
  columns: readonly DataColumn<T>[];
  visibility: ColumnVisibility;
  /** Columns that cannot be hidden; defaults to the first column. */
  locked?: readonly string[];
}) {
  const fixed = new Set(locked ?? (columns[0] ? [columns[0].id] : []));
  const choices = columns.filter(
    (column) => !fixed.has(column.id) && !column.headerHidden && !column.phoneOnly,
  );
  if (choices.length === 0) return null;
  return (
    <StaffMenu>
      <StaffMenuTrigger asChild>
        <StaffButton size="sm" variant="secondary" icon={<Columns3 aria-hidden />}>
          Columns
        </StaffButton>
      </StaffMenuTrigger>
      <StaffMenuContent align="end" className="w-56">
        <StaffMenuLabel>Show columns</StaffMenuLabel>
        {choices.map((column) => (
          <StaffMenuCheckboxItem
            key={column.id}
            checked={!visibility.hidden.has(column.id)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) => visibility.setHidden(column.id, !checked)}
          >
            {column.header}
          </StaffMenuCheckboxItem>
        ))}
        {visibility.changed ? (
          <>
            <StaffMenuSeparator />
            <StaffMenuItem onSelect={visibility.reset}>Reset columns</StaffMenuItem>
          </>
        ) : null}
      </StaffMenuContent>
    </StaffMenu>
  );
}
