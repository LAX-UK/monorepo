"use client";

import {
  StaffButton,
  StaffMenu,
  StaffMenuCheckboxItem,
  StaffMenuContent,
  StaffMenuLabel,
  StaffMenuSeparator,
  StaffMenuTrigger,
} from "@auction/staff-ui";
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

/** Choose which table columns are shown. */
export function AdminTableColumnPicker({
  columns,
  columnVisibility,
  onColumnVisibilityChange,
}: Props) {
  const hideable = columns.filter((c) => c.canHide !== false);
  if (hideable.length === 0) return null;

  return (
    <StaffMenu>
      <StaffMenuTrigger asChild>
        <StaffButton
          size="sm"
          variant="secondary"
          icon={<Columns3 aria-hidden />}
          aria-label="Choose visible columns"
        >
          Columns
        </StaffButton>
      </StaffMenuTrigger>
      <StaffMenuContent align="end" className="w-56">
        <StaffMenuLabel>Show columns</StaffMenuLabel>
        <StaffMenuSeparator />
        {hideable.map((col) => (
          <StaffMenuCheckboxItem
            key={col.id}
            checked={columnVisibility[col.id] !== false}
            onCheckedChange={(visible) =>
              onColumnVisibilityChange({ ...columnVisibility, [col.id]: visible })
            }
          >
            {col.label}
          </StaffMenuCheckboxItem>
        ))}
      </StaffMenuContent>
    </StaffMenu>
  );
}
