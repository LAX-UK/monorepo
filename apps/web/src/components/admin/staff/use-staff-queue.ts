"use client";

import {
  type DataColumn,
  type PanelQueue,
  type QueuePanelState,
  type SortState,
  useQueuePanel,
  useSortedRows,
} from "@auction/staff-ui";
import { useEffect, useMemo } from "react";

export type StaffQueueOptions<T> = {
  /** The search param that holds the open record's id, e.g. "payment". */
  param: string;
  rows: readonly T[];
  getId: (row: T) => string;
  /** The id in the URL when the page loaded. */
  initialId: string | null | undefined;
  /** The list's address with a record's panel open, built from the list's own state. */
  hrefFor: (id: string | null) => string;
  /**
   * Columns and first sort for a list sorted on the page: the panel steps in the order shown.
   * Leave out when the server sorts the rows (the rows are already in order).
   */
  localSort?: { columns: readonly DataColumn<T>[]; defaultSort: SortState };
  /**
   * The record's own page, when it has one: the row's link (a new tab opens the page), and the
   * panel's "Open full page". Without one, the row's link is the panel's address.
   */
  pageHref?: (row: T) => string | null;
  /** The record the server loaded for the URL when it is not among the rows shown. */
  selected?: T | null;
  /** How many records the whole queue holds, when more than the rows shown. */
  total?: number;
  /** How many records come before the rows shown (a later page), so "51 of 120" is in the queue. */
  offset?: number;
  /** What the queue holds, singular, for "Next hold". */
  noun?: string;
  /**
   * Keep the address of a record that is not in the list (default: close the panel). For a list
   * whose panel says the record was not found.
   */
  keepMissing?: boolean;
};

export type StaffQueue<T> = QueuePanelState & {
  /** The record the panel shows, or null when it is closed or the record is not in the list. */
  record: T | null;
  /** Spread into `DetailPanel`: open while a listed record is shown, its place and stepping. */
  panelProps: { open: boolean; onOpenChange: (open: boolean) => void; queue?: PanelQueue };
  /** Spread into `ListPage`'s `table`: rows in the order shown, the panel on a row's open. */
  table: {
    data: readonly T[];
    rowHref: (row: T) => string;
    onRowOpen: (row: T) => void;
    activeRowId: string | null;
    sort?: SortState;
    onSortChange?: (sort: SortState) => void;
  };
};

/**
 * A Bid admin work queue's panel (staff design standard PRD-7): the open record in the URL, a
 * history entry on open so Back closes it, its place in the list ("3 of 12") and J/K stepping in
 * the order the rows are shown. A row's link is the panel's address, so a new tab or a copied link
 * opens the same record. A record that leaves the list (resolved, refunded) closes its panel.
 */
export function useStaffQueue<T>(options: StaffQueueOptions<T>): StaffQueue<T> {
  const { param, rows, getId, initialId, hrefFor, localSort, selected, total, noun } = options;
  const offset = options.offset ?? 0;
  const sorted = useSortedRows({
    data: rows,
    columns: localSort?.columns ?? [],
    ...(localSort ? { defaultSort: localSort.defaultSort } : {}),
  });
  const ordered = localSort ? sorted.rows : rows;
  const ids = useMemo(() => ordered.map(getId), [ordered, getId]);
  const panel = useQueuePanel({
    param,
    ids,
    initialId: initialId ?? null,
    hrefFor,
    ...(total !== undefined ? { total } : {}),
    ...(noun ? { noun } : {}),
  });
  const { openId, close } = panel;
  const record = useMemo(() => {
    if (!openId) return null;
    const listed = ordered.find((row) => getId(row) === openId);
    if (listed) return listed;
    return selected && getId(selected) === openId ? selected : null;
  }, [openId, ordered, getId, selected]);

  const missing = Boolean(openId) && record === null && !options.keepMissing;
  useEffect(() => {
    if (missing) close();
  }, [missing, close]);

  return {
    ...panel,
    record,
    panelProps: {
      open: record !== null,
      onOpenChange: panel.onOpenChange,
      ...(panel.queue
        ? { queue: { ...panel.queue, position: panel.queue.position + offset } }
        : {}),
    },
    table: {
      data: ordered,
      rowHref: (row) => options.pageHref?.(row) ?? hrefFor(getId(row)),
      onRowOpen: (row) => panel.open(getId(row)),
      activeRowId: openId,
      ...(localSort && sorted.sort ? { sort: sorted.sort, onSortChange: sorted.onSortChange } : {}),
    },
  };
}
