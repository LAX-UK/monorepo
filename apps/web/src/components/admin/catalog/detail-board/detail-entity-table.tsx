import { cn } from "@auction/ui";
import { Checkbox } from "@auction/ui/components/checkbox";
import { EmptyState } from "@auction/ui/components/empty-state";
import type { ReactNode } from "react";

export type DetailEntityColumn<TRow> = {
  id: string;
  header: ReactNode;
  cell: (row: TRow) => ReactNode;
  className?: string;
  headerClassName?: string;
};

type DetailEntityTableBaseProps<TRow> = {
  rows: readonly TRow[];
  columns: readonly DetailEntityColumn<TRow>[];
  getRowId: (row: TRow) => string;
  ariaLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  footer?: ReactNode;
  className?: string;
};

type DetailEntityTableSelectionProps =
  | {
      selectable: true;
      selectedIds: ReadonlySet<string>;
      onToggleRow: (id: string, checked: boolean) => void;
      onToggleAll: (checked: boolean) => void;
    }
  | {
      selectable?: false;
      selectedIds?: never;
      onToggleRow?: never;
      onToggleAll?: never;
    };

export type DetailEntityTableProps<TRow> = DetailEntityTableBaseProps<TRow> &
  DetailEntityTableSelectionProps;

/** Generic entity table for detail tab boards. */
export function DetailEntityTable<TRow>({
  rows,
  columns,
  getRowId,
  ariaLabel = "Entity details",
  emptyTitle = "Nothing here yet",
  emptyDescription,
  selectable = false,
  selectedIds,
  onToggleRow,
  onToggleAll,
  footer,
  className,
}: DetailEntityTableProps<TRow>) {
  const allSelected =
    selectable && rows.length > 0 && rows.every((row) => selectedIds?.has(getRowId(row)));

  if (rows.length === 0) {
    return (
      <div className={className}>
        <EmptyState
          title={emptyTitle}
          {...(emptyDescription ? { description: emptyDescription } : {})}
        />
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[36rem] text-left font-body text-sm">
        <caption className="sr-only">{ariaLabel}</caption>
        <thead>
          <tr className="h-12 border-b border-shell-stroke bg-surface-container-low/50 font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            {selectable ? (
              <th className="w-12 px-3 py-0">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => onToggleAll?.(v === true)}
                  aria-label="Select all rows"
                />
              </th>
            ) : null}
            {columns.map((col) => (
              <th key={col.id} className={cn("px-3 py-0 pr-4", col.headerClassName)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = getRowId(row);
            return (
              <tr
                key={id}
                className="h-14 border-b border-shell-stroke/60 last:border-0 hover:bg-surface-container-low/30"
              >
                {selectable ? (
                  <td className="w-12 px-3 py-0">
                    <Checkbox
                      checked={selectedIds?.has(id) ?? false}
                      onCheckedChange={(v) => onToggleRow?.(id, v === true)}
                      aria-label={`Select row ${id}`}
                    />
                  </td>
                ) : null}
                {columns.map((col) => (
                  <td key={col.id} className={cn("px-3 py-0 pr-4", col.className)}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {footer ? (
        <div className="border-t border-shell-stroke px-3 py-4 font-body text-xs text-on-surface-variant">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
