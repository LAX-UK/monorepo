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
 * Which of a list's columns are hidden, remembered per list in this browser. Starts from the
 * list's defaults (`defaultHidden`) so a lower-priority column can ship hidden.
 */
export function useColumnVisibility(
  listKey: string,
  defaultHidden: readonly string[] = [],
): ColumnVisibility {
  // Keyed by content, so an inline array does not reset the choice on every render.
  const defaultsKey = defaultHidden.join("\n");
  // biome-ignore lint/correctness/useExhaustiveDependencies: defaultsKey is the content of defaultHidden
  const defaults = React.useMemo(() => new Set(defaultHidden), [defaultsKey]);
  const [hidden, setHiddenState] = React.useState<ReadonlySet<string>>(defaults);
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKeyOf(listKey));
      if (!stored) return;
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setHiddenState(new Set(parsed.filter((id): id is string => typeof id === "string")));
      }
    } catch {
      // Storage unavailable or unreadable: keep the defaults.
    }
  }, [listKey]);
  const persist = React.useCallback(
    (next: ReadonlySet<string>) => {
      setHiddenState(next);
      try {
        if (sameSet(next, defaults)) window.localStorage.removeItem(storageKeyOf(listKey));
        else window.localStorage.setItem(storageKeyOf(listKey), JSON.stringify([...next]));
      } catch {
        // Storage unavailable: the choice lasts for this page only.
      }
    },
    [listKey, defaults],
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
  const choices = columns.filter((column) => !fixed.has(column.id) && !column.headerHidden);
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
