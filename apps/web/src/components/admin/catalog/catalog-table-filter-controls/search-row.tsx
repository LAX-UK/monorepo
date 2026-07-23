"use client";

import { AdminListSearch } from "@/components/admin/admin-list-search";
import { searchInputIdFor } from "@/components/admin/catalog/catalog-filter-sheet-primitive";
import { cn } from "@auction/ui";

export function TableFilterSearchRow({
  searchPlaceholder,
  searchInputId = "admin-list-search-q",
  placement,
  className,
}: {
  searchPlaceholder: string;
  searchInputId?: string;
  placement: "toolbar" | "mobile" | "sheet";
  className?: string;
}) {
  return (
    <AdminListSearch
      placeholder={searchPlaceholder}
      className={cn("w-full", className)}
      inputId={searchInputIdFor(searchInputId, placement)}
    />
  );
}
