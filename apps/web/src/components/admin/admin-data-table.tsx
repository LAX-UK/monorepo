"use client";

import {
  AdminTableColumnPicker,
  type ColumnPickerOption,
} from "@/components/admin/admin-table-column-picker";
import { popHotkeyScope, pushHotkeyScope } from "@/lib/hotkeys/hotkey-registry";
import { isEditableTarget } from "@/lib/hotkeys/is-editable-target";
import { DataTable } from "@auction/ui";
import type {
  ColumnDef,
  OnChangeFn,
  RowSelectionState,
  VisibilityState,
} from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

type AdminColumnMeta = { numeric?: boolean };

function withNumericCells<TData, TValue>(
  columns: ColumnDef<TData, TValue>[],
): ColumnDef<TData, TValue>[] {
  return columns.map((col) => {
    const meta = col.meta as AdminColumnMeta | undefined;
    if (!meta?.numeric || !col.cell) return col;
    const originalCell = col.cell;
    return {
      ...col,
      cell: (ctx) => <span className="tabular-nums">{flexRender(originalCell, ctx)}</span>,
    };
  });
}

function columnPickerOptions<TData, TValue>(
  columns: ColumnDef<TData, TValue>[],
): ColumnPickerOption[] {
  const options: ColumnPickerOption[] = [];
  for (const col of columns) {
    const id = ("accessorKey" in col && col.accessorKey ? String(col.accessorKey) : col.id) ?? "";
    if (!id || id === "__select") continue;
    const label =
      typeof col.header === "string"
        ? col.header
        : id === "actions"
          ? "Actions"
          : id.replace(/_/g, " ");
    options.push({
      id,
      label,
      canHide: col.enableHiding !== false && id !== "actions",
    });
  }
  return options;
}

function loadVisibility(storageKey: string, defaults?: VisibilityState): VisibilityState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults ?? {};
    return JSON.parse(raw) as VisibilityState;
  } catch {
    return defaults ?? {};
  }
}

type AdminDataTableProps<TData, TValue> = {
  ariaLabel: string;
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage?: string;
  emptyComponent?: ReactNode;
  className?: string;
  enableRowSelection?: boolean;
  getRowId?: (row: TData, index: number) => string;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  density?: "comfortable" | "compact";
  columnVisibilityStorageKey?: string;
  /** Applied when localStorage has no saved layout for the storage key. */
  defaultColumnVisibility?: VisibilityState;
  showColumnPicker?: boolean;
  toolbarEnd?: ReactNode;
  stickyHeader?: boolean;
  stickyFirstColumn?: boolean;
  /** j/k row focus, Enter open, e edit, . toggle select, a select all, Esc clear focus */
  enableKeyboardNav?: boolean;
  getRowHref?: (row: TData) => string | undefined;
  getRowEditHref?: (row: TData) => string | undefined;
  onRowActivate?: (row: TData) => void;
  /** Applies CSS row virtualization when row count meets threshold (default 48). */
  virtualizeRowThreshold?: number;
};

/** Staff list tables: server-driven sort, a11y caption, optional column picker + bulk selection. */
export function AdminDataTable<TData, TValue>({
  ariaLabel,
  columns,
  columnVisibilityStorageKey,
  defaultColumnVisibility,
  showColumnPicker = false,
  toolbarEnd,
  stickyHeader = false,
  stickyFirstColumn = false,
  className,
  enableKeyboardNav = false,
  getRowId,
  getRowHref,
  getRowEditHref,
  onRowActivate,
  virtualizeRowThreshold = 48,
  enableRowSelection,
  rowSelection,
  onRowSelectionChange,
  data,
  ...props
}: AdminDataTableProps<TData, TValue>) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const tableColumns = useMemo(() => withNumericCells(columns), [columns]);
  const pickerColumns = useMemo(() => columnPickerOptions(tableColumns), [tableColumns]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const resolveRowId = useCallback(
    (row: TData, index: number) => (getRowId ? getRowId(row, index) : String(index)),
    [getRowId],
  );

  const rowIds = useMemo(
    () => data.map((row, index) => resolveRowId(row, index)),
    [data, resolveRowId],
  );

  const focusedRowId =
    focusedIndex !== null && focusedIndex >= 0 && focusedIndex < rowIds.length
      ? rowIds[focusedIndex]
      : null;

  useEffect(() => {
    if (!columnVisibilityStorageKey) return;
    setColumnVisibility(loadVisibility(columnVisibilityStorageKey, defaultColumnVisibility));
  }, [columnVisibilityStorageKey, defaultColumnVisibility]);

  useEffect(() => {
    if (!enableKeyboardNav) return;
    pushHotkeyScope("table");
    return () => popHotkeyScope("table");
  }, [enableKeyboardNav]);

  useEffect(() => {
    if (focusedIndex === null) return;
    if (focusedIndex >= data.length) setFocusedIndex(data.length > 0 ? data.length - 1 : null);
  }, [data.length, focusedIndex]);

  useEffect(() => {
    if (!enableKeyboardNav) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (
        !rootRef.current?.contains(document.activeElement) &&
        document.activeElement !== document.body
      ) {
        const tag = document.activeElement?.tagName;
        if (tag && tag !== "BODY" && !rootRef.current?.matches(":focus-within")) {
          return;
        }
      }

      const rowCount = data.length;
      if (rowCount === 0) return;

      if (event.key === "j" || event.key === "k") {
        event.preventDefault();
        setFocusedIndex((prev) => {
          const start = prev ?? -1;
          const delta = event.key === "j" ? 1 : -1;
          const next =
            start < 0
              ? delta > 0
                ? 0
                : rowCount - 1
              : Math.max(0, Math.min(rowCount - 1, start + delta));
          return next;
        });
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setFocusedIndex(null);
        return;
      }

      if (focusedIndex === null) return;
      const row = data[focusedIndex];
      if (!row) return;

      if (event.key === "Enter") {
        event.preventDefault();
        if (onRowActivate) {
          onRowActivate(row);
          return;
        }
        const href = getRowHref?.(row);
        if (href) router.push(href);
        return;
      }

      if (event.key === "e") {
        event.preventDefault();
        const editHref = getRowEditHref?.(row) ?? getRowHref?.(row);
        if (editHref) router.push(editHref.includes("/edit") ? editHref : `${editHref}/edit`);
        return;
      }

      if (event.key === "." && enableRowSelection && onRowSelectionChange) {
        event.preventDefault();
        const id = resolveRowId(row, focusedIndex);
        const next = { ...(rowSelection ?? {}), [id]: !rowSelection?.[id] };
        if (!next[id]) delete next[id];
        onRowSelectionChange(next);
        return;
      }

      if ((event.key === "a" || event.key === "A") && enableRowSelection && onRowSelectionChange) {
        event.preventDefault();
        const allSelected = rowIds.every((id) => rowSelection?.[id]);
        if (allSelected) {
          onRowSelectionChange({});
        } else {
          onRowSelectionChange(Object.fromEntries(rowIds.map((id) => [id, true])));
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    enableKeyboardNav,
    data,
    focusedIndex,
    getRowHref,
    getRowEditHref,
    onRowActivate,
    enableRowSelection,
    onRowSelectionChange,
    rowSelection,
    rowIds,
    resolveRowId,
    router,
  ]);

  const onColumnVisibilityChange = useCallback<OnChangeFn<VisibilityState>>(
    (updater) => {
      setColumnVisibility((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (columnVisibilityStorageKey) {
          try {
            localStorage.setItem(columnVisibilityStorageKey, JSON.stringify(next));
          } catch {
            /* ignore */
          }
        }
        return next;
      });
    },
    [columnVisibilityStorageKey],
  );

  const showToolbar = showColumnPicker || toolbarEnd;
  const virtualizeRows = data.length >= virtualizeRowThreshold;

  return (
    <div ref={rootRef} className="space-y-2" tabIndex={enableKeyboardNav ? -1 : undefined}>
      {showToolbar ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {showColumnPicker ? (
            <AdminTableColumnPicker
              columns={pickerColumns}
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={onColumnVisibilityChange}
            />
          ) : null}
          {toolbarEnd}
        </div>
      ) : null}
      <DataTable
        ariaLabel={ariaLabel}
        enableClientSort={false}
        columns={tableColumns}
        data={data}
        {...(enableKeyboardNav && focusedRowId ? { focusedRowId } : {})}
        {...(getRowId ? { getRowId } : {})}
        {...(enableRowSelection
          ? {
              enableRowSelection,
              ...(rowSelection !== undefined ? { rowSelection } : {}),
              ...(onRowSelectionChange ? { onRowSelectionChange } : {}),
            }
          : {})}
        {...(stickyHeader || stickyFirstColumn || className
          ? {
              className: [
                "admin-data-table-stagger",
                virtualizeRows && "admin-data-table-virtualized",
                stickyHeader &&
                  "[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-surface-container-lowest",
                stickyFirstColumn &&
                  "[&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:z-20 [&_th:first-child]:bg-surface-container-lowest [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:z-[5] [&_td:first-child]:bg-surface-container-lowest",
                enableKeyboardNav && "[&_[data-focused=true]]:scroll-mt-16",
                className,
              ]
                .filter(Boolean)
                .join(" "),
            }
          : {
              className: [
                "admin-data-table-stagger",
                virtualizeRows && "admin-data-table-virtualized",
                enableKeyboardNav ? "[&_[data-focused=true]]:scroll-mt-16" : "",
              ]
                .filter(Boolean)
                .join(" "),
            })}
        {...(columnVisibilityStorageKey || showColumnPicker
          ? { columnVisibility, onColumnVisibilityChange }
          : {})}
        {...props}
      />
    </div>
  );
}
