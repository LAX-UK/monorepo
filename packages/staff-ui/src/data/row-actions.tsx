"use client";

import type { LinkComponent } from "@auction/ui/lax";
import { type OverflowAction, OverflowMenu } from "../shell/overflow-menu.js";
import type { DataColumn } from "./types.js";

/**
 * A row's `…` menu: always visible (never on hover only), 24px, in the last column. Holds every
 * action for the row; destructive ones come last in danger text. Money and irreversible actions
 * open a confirm dialog from here, so no row carries an inline red button. While rows are
 * selected the menu steps aside for the bulk bar.
 */
export function RowActions({
  actions,
  label,
  Link,
}: {
  actions: readonly OverflowAction[];
  /** Names the row: "Actions for payment Golden Hour". */
  label: string;
  Link?: LinkComponent;
}) {
  return (
    <OverflowMenu actions={actions} label={label} size="icon-xs" {...(Link ? { Link } : {})} />
  );
}

/**
 * The standard last column of a list: a 56px cell holding the row's `…` menu, with the header
 * kept for screen readers only. On a phone the menu sits at the right of each stacked row.
 */
export function rowActionsColumn<T>({
  actions,
  label,
  Link,
}: {
  actions: (row: T) => readonly OverflowAction[];
  /** The menu's accessible name for a row: (row) => `Actions for ${row.title}`. */
  label: (row: T) => string;
  Link?: LinkComponent;
}): DataColumn<T> {
  return {
    id: "actions",
    header: "Actions",
    headerHidden: true,
    width: "56px",
    truncate: false,
    mobile: "actions",
    cell: (row) => (
      <div className="flex justify-end">
        <RowActions actions={actions(row)} label={label(row)} {...(Link ? { Link } : {})} />
      </div>
    ),
  };
}
