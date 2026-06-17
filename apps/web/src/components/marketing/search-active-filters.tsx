"use client";

import { CatalogActiveFilterChips } from "@/components/marketing/catalog-active-filter-chips";
import { useSearchCatalogPending } from "@/components/marketing/search-catalog-client";
import { type SearchSortValue, sortLabel } from "@/components/marketing/search-sort-select";
import {
  parseSearchEnding,
  parseSearchStatus,
  searchEndingLabel,
  searchStatusLabel,
} from "@/lib/marketing/parse-search-params";
import type { Category } from "@auction/types";
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
  className,
}: {
  categories: Category[];
  sort: SearchSortValue;
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { pending, navigate } = useSearchCatalogPending();

  const q = searchParams.get("q")?.trim() ?? "";
  const categoryId = searchParams.get("categoryId") ?? "";
  const categoryName = categories.find((c) => c.id === categoryId)?.name;
  const status = parseSearchStatus(searchParams.get("status") ?? undefined);
  const ending = parseSearchEnding(searchParams.get("ending") ?? undefined);

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
  if (status) {
    chips.push({
      key: "status",
      label: searchStatusLabel(status),
      removeHref: buildRemoveHref(pathname, searchParams, ["status"]),
    });
  }
  if (ending) {
    chips.push({
      key: "ending",
      label: searchEndingLabel(ending),
      removeHref: buildRemoveHref(pathname, searchParams, ["ending"]),
    });
  }
  if (sort !== "endingAsc") {
    chips.push({
      key: "sort",
      label: sortLabel(sort),
      removeHref: buildRemoveHref(pathname, searchParams, ["sort"]),
    });
  }

  return (
    <CatalogActiveFilterChips
      chips={chips}
      clearHref="/search"
      pending={pending}
      onNavigate={navigate}
      {...(className ? { className } : {})}
    />
  );
}
