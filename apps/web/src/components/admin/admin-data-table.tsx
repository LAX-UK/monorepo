"use client";

import {
  AdminTableColumnPicker,
  type ColumnPickerOption,
} from "@/components/admin/admin-table-column-picker";
import { DataTable } from "@auction/ui";
import type {
  ColumnDef,
  OnChangeFn,
  RowSelectionState,
  VisibilityState,
} from "@tanstack/react-table";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

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

function loadVisibility(storageKey: string): VisibilityState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    return JSON.parse(raw) as VisibilityState;
  } catch {
    return {};
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
  /** Persist column visibility in localStorage under this key */
  columnVisibilityStorageKey?: string;
  showColumnPicker?: boolean;
  toolbarEnd?: ReactNode;
};

/** Staff list tables: server-driven sort, a11y caption, optional column picker + bulk selection. */
export function AdminDataTable<TData, TValue>({
  ariaLabel,
  columns,
  columnVisibilityStorageKey,
  showColumnPicker = false,
  toolbarEnd,
  ...props
}: AdminDataTableProps<TData, TValue>) {
  const pickerColumns = useMemo(() => columnPickerOptions(columns), [columns]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  useEffect(() => {
    if (!columnVisibilityStorageKey) return;
    setColumnVisibility(loadVisibility(columnVisibilityStorageKey));
  }, [columnVisibilityStorageKey]);

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

  return (
    <div className="space-y-2">
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
        columns={columns}
        {...(columnVisibilityStorageKey || showColumnPicker
          ? { columnVisibility, onColumnVisibilityChange }
          : {})}
        {...props}
      />
    </div>
  );
}
