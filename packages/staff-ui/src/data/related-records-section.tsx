import type { LinkComponent } from "@auction/ui/lax";
import type * as React from "react";
import { EmptyState, Section } from "../display/states.js";
import { DataTable } from "./data-table.js";
import type { DataColumn, SortState, TableDensity } from "./types.js";

export type RelatedRecordsSectionProps<T> = {
  /** Anchor for links such as `#orders`. */
  id?: string;
  title: string;
  description?: React.ReactNode;
  /** The table's accessible name; defaults to the title. */
  label?: string;
  columns: readonly DataColumn<T>[];
  data: readonly T[];
  getRowId: (row: T) => string;
  /** The order the rows arrive in, shown on the header; give every related table one. */
  defaultSort: SortState;
  onRowOpen?: (row: T) => void;
  /** What the section will show and how it gets there, when it has no rows yet. */
  empty: { title: string; description?: React.ReactNode; action?: React.ReactNode };
  /**
   * The full list filtered to this record, when the section shows only the newest rows:
   * "View all 23" in the section's header.
   */
  viewAll?: { href: string; total: number; Link: LinkComponent } | null;
  /**
   * One action for the section, e.g. "Grant sale authority". While the section is empty and its
   * `empty` state has an action, only the empty state shows it.
   */
  action?: React.ReactNode;
  /** Comfortable when a cell carries a second line; compact otherwise. */
  density?: TableDensity;
};

/**
 * A record's related rows (orders, editions, requests…) as one kit section holding a compact
 * embedded table. The section is the card: its header names the rows, holds one action and,
 * when only the newest rows are shown, "View all" with the total, linking to the full list.
 * An empty section says what will appear here.
 */
export function RelatedRecordsSection<T>({
  id,
  title,
  description,
  label,
  columns,
  data,
  getRowId,
  defaultSort,
  onRowOpen,
  empty,
  viewAll,
  action,
  density = "compact",
}: RelatedRecordsSectionProps<T>) {
  const more = viewAll && viewAll.total > data.length ? viewAll : null;
  // An empty section offers its creating action once, in the empty state, not twice.
  const headerButton = data.length === 0 && empty.action ? null : action;
  const headerAction =
    more || headerButton ? (
      <>
        {more ? (
          <more.Link
            href={more.href}
            className="staff-focus rounded-staff-xs text-staff-sm font-medium text-staff-fg underline-offset-2 decoration-staff-line-strong hover:underline"
          >
            View all {more.total.toLocaleString("en-GB")}
          </more.Link>
        ) : null}
        {headerButton}
      </>
    ) : null;
  return (
    <Section
      {...(id ? { id } : {})}
      title={title}
      {...(description ? { description } : {})}
      {...(headerAction ? { action: headerAction } : {})}
      className="scroll-mt-20"
      bodyClassName="p-0"
    >
      <DataTable<T>
        embedded
        label={label ?? title}
        columns={columns}
        data={data}
        getRowId={getRowId}
        density={density}
        defaultSort={defaultSort}
        stickyHeader={false}
        stickyToolbar={false}
        {...(onRowOpen ? { onRowOpen } : {})}
        empty={
          <EmptyState
            size="compact"
            headingLevel="h3"
            title={empty.title}
            {...(empty.description ? { description: empty.description } : {})}
            {...(empty.action ? { action: empty.action } : {})}
          />
        }
      />
    </Section>
  );
}
