"use client";

import { type SortDirection, sortDirectionForValue } from "@/lib/admin/list-sort";
import { cn } from "@auction/ui";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export type AdminSortableColumnHeaderProps = {
  label: ReactNode;
  sortValue: string;
  currentSort?: string | undefined;
  href: string;
  /** Override inferred direction from sort value */
  direction?: SortDirection;
  className?: string;
};

/** Server-driven list column header — navigates via href instead of client sort. */
export function AdminSortableColumnHeader({
  label,
  sortValue,
  currentSort,
  href,
  direction,
  className,
}: AdminSortableColumnHeaderProps) {
  const isActive = currentSort === sortValue;
  const resolvedDirection = direction ?? sortDirectionForValue(sortValue);
  const ariaSort = isActive ? (resolvedDirection === "asc" ? "ascending" : "descending") : "none";
  const SortIcon = isActive ? (resolvedDirection === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
  const labelText = typeof label === "string" ? label : "column";

  return (
    <span aria-sort={ariaSort} className="inline-flex">
      <Link
        href={href}
        className={cn(
          "-ml-1 inline-flex min-h-10 items-center gap-1 rounded-md px-2 font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface",
          isActive && "text-on-surface",
          className,
        )}
      >
        <span>{label}</span>
        <SortIcon className={cn("size-4 shrink-0", !isActive && "opacity-50")} aria-hidden />
        <span className="sr-only">
          {isActive
            ? `Sorted ${resolvedDirection === "asc" ? "ascending" : "descending"}. Click to clear sort.`
            : `Sort by ${labelText}`}
        </span>
      </Link>
    </span>
  );
}
