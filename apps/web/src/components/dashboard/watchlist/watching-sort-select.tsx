"use client";

import {
  WATCHLIST_SORT_OPTIONS,
  type WatchlistSortOption,
} from "@/lib/dashboard/filters/watchlist/watchlist-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useTransition } from "react";

/** The order of the followed lots, kept in the address so it survives a reload. */
export function WatchingSortSelect({ value }: { value: WatchlistSortOption }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const labelId = useId();

  const onChange = (next: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("sort", next);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  return (
    <div className="flex items-center gap-2">
      <span id={labelId} className="font-body text-sm text-on-surface-variant">
        Sort
      </span>
      <Select value={value} onValueChange={onChange} disabled={pending}>
        <SelectTrigger aria-labelledby={labelId} className="h-10 w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {WATCHLIST_SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
