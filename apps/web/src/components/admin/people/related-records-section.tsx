import {
  type DataColumn,
  DataTable,
  EmptyState,
  Section,
  type SortState,
  type TableDensity,
} from "@auction/staff-ui";
import type { ReactNode } from "react";

type Props<T> = {
  /** Anchor for links such as `#kyc-history`. */
  id?: string;
  title: string;
  description?: ReactNode;
  /** One action for the section, e.g. "Open AML list". */
  action?: ReactNode;
  /** The table's accessible name. */
  label: string;
  columns: readonly DataColumn<T>[];
  data: readonly T[];
  getRowId: (row: T) => string;
  /** The order when nothing else is chosen; give every related table one. */
  defaultSort: SortState;
  onRowOpen?: (row: T) => void;
  /** What the section shows once it has rows, and how one gets there. */
  empty: { title: string; description: ReactNode; action?: ReactNode };
  /** A line under the rows: "Showing the latest 50 bids". */
  footer?: ReactNode;
  /** A search or filter row above the table. */
  toolbar?: ReactNode;
  /** Comfortable when a cell carries a second line (a lot and its sale); compact otherwise. */
  density?: TableDensity;
  /** Work below the rows, such as a way to add one, separated by a hairline. */
  children?: ReactNode;
};

/**
 * A record's related rows (identity checks, bids, payments…) as one kit section holding a compact
 * table. The section is the card; an empty one says what will appear here.
 */
export function RelatedRecordsSection<T>({
  id,
  title,
  description,
  action,
  label,
  columns,
  data,
  getRowId,
  defaultSort,
  onRowOpen,
  empty,
  footer,
  toolbar,
  density = "compact",
  children,
}: Props<T>) {
  return (
    <Section
      {...(id ? { id } : {})}
      title={title}
      {...(description ? { description } : {})}
      {...(action ? { action } : {})}
      className="scroll-mt-20"
      bodyClassName="p-0"
    >
      <DataTable<T>
        embedded
        label={label}
        columns={columns}
        data={data}
        getRowId={getRowId}
        density={density}
        defaultSort={defaultSort}
        stickyHeader={false}
        stickyToolbar={false}
        {...(onRowOpen ? { onRowOpen } : {})}
        {...(toolbar ? { toolbar } : {})}
        empty={
          <EmptyState
            headingLevel="h3"
            title={empty.title}
            description={empty.description}
            {...(empty.action ? { action: empty.action } : {})}
          />
        }
        {...(footer
          ? {
              footer: (
                <p className="border-t border-staff-line px-4 py-2.5 text-staff-sm text-staff-muted">
                  {footer}
                </p>
              ),
            }
          : {})}
      />
      {children ? <div className="border-t border-staff-line p-4">{children}</div> : null}
    </Section>
  );
}
