"use client";

import { MarketingChipStrip } from "@/components/marketing/marketing-chip-strip";
import { useSearchCatalogPending } from "@/components/marketing/search-catalog-client";
import { type SearchSortValue, sortLabel } from "@/components/marketing/search-sort-select";
import type { Category } from "@auction/types";
import { cn } from "@auction/ui";
import { X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

type Chip = { key: string; label: string; removeHref: string };

function buildRemoveHref(
  pathname: string,
  searchParams: URLSearchParams,
  removeKeys: string[],
): string {
  const next = new URLSearchParams(searchParams.toString());
  for (const key of removeKeys) next.delete(key);
  next.set("offset", "0");
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function SearchActiveFilters({
  categories,
  sort,
}: {
  categories: Category[];
  sort: SearchSortValue;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { pending, navigate } = useSearchCatalogPending();

  const q = searchParams.get("q")?.trim() ?? "";
  const categoryId = searchParams.get("categoryId") ?? "";
  const categoryName = categories.find((c) => c.id === categoryId)?.name;

  const chips: Chip[] = [];
  if (q) {
    chips.push({
      key: "q",
      label: `Search: “${q}”`,
      removeHref: buildRemoveHref(pathname, searchParams, ["q"]),
    });
  }
  if (categoryId && categoryName) {
    chips.push({
      key: "categoryId",
      label: categoryName,
      removeHref: buildRemoveHref(pathname, searchParams, ["categoryId"]),
    });
  }
  if (sort !== "endingAsc") {
    chips.push({
      key: "sort",
      label: sortLabel(sort),
      removeHref: buildRemoveHref(pathname, searchParams, ["sort"]),
    });
  }

  if (chips.length === 0) return null;

  return (
    <MarketingChipStrip
      wrapOnDesktop
      aria-label="Active filters"
      className={cn("mb-4 md:mb-6", pending && "opacity-70 motion-safe:transition-opacity")}
    >
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          disabled={pending}
          onClick={() => navigate(chip.removeHref)}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 font-label text-[0.65rem] font-semibold uppercase tracking-wider text-on-surface hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
        >
          <span>{chip.label}</span>
          <X className="size-3.5 shrink-0" aria-hidden />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      <button
        type="button"
        disabled={pending}
        onClick={() => navigate("/search")}
        className="min-h-[36px] px-2 font-label text-[0.65rem] font-semibold uppercase tracking-wider text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
      >
        Clear all
      </button>
    </MarketingChipStrip>
  );
}
