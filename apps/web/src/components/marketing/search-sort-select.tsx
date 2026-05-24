"use client";

import { useSearchCatalogPending } from "@/components/marketing/search-catalog-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { usePathname, useSearchParams } from "next/navigation";

export const SORT_OPTIONS = [
  { value: "endingAsc", label: "Ending soon" },
  { value: "createdDesc", label: "Newest" },
  { value: "hammerDesc", label: "Price · High to low" },
] as const;

export type SearchSortValue = (typeof SORT_OPTIONS)[number]["value"];

function buildHref(pathname: string, searchParams: URLSearchParams, sort: SearchSortValue): string {
  const next = new URLSearchParams(searchParams.toString());
  next.set("offset", "0");
  if (sort === "endingAsc") next.delete("sort");
  else next.set("sort", sort);
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function SearchSortSelect({ value }: { value: SearchSortValue }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { pending, navigate } = useSearchCatalogPending();

  return (
    <Select
      value={value}
      disabled={pending}
      onValueChange={(next) => {
        navigate(buildHref(pathname, searchParams, next as SearchSortValue));
      }}
    >
      <SelectTrigger
        aria-label="Sort results"
        className="min-h-[var(--tap-target-min,44px)] h-[var(--tap-target-min,44px)] w-auto min-w-[9.5rem] max-w-[12rem] cursor-pointer border-outline-variant/40 bg-surface-container-lowest px-3 font-label text-[0.65rem] font-semibold uppercase tracking-wider shadow-none focus:ring-primary"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function sortLabel(value: SearchSortValue): string {
  return SORT_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
