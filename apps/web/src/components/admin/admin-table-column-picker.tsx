"use client";

import { Button } from "@auction/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import type { VisibilityState } from "@tanstack/react-table";
import { Columns3 } from "lucide-react";

export type ColumnPickerOption = {
  id: string;
  label: string;
  canHide?: boolean;
};

type Props = {
  columns: readonly ColumnPickerOption[];
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (next: VisibilityState) => void;
};

export function AdminTableColumnPicker({
  columns,
  columnVisibility,
  onColumnVisibilityChange,
}: Props) {
  const hideable = columns.filter((c) => c.canHide !== false);
  if (hideable.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9 gap-1.5 font-label text-xs"
          aria-label="Choose visible columns"
        >
          <Columns3 className="size-4" aria-hidden />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]">
          Visible columns
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hideable.map((col) => {
          const checked = columnVisibility[col.id] !== false;
          return (
            <DropdownMenuCheckboxItem
              key={col.id}
              checked={checked}
              onCheckedChange={(visible) => {
                onColumnVisibilityChange({
                  ...columnVisibility,
                  [col.id]: visible,
                });
              }}
            >
              {col.label}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
