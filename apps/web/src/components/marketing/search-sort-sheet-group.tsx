"use client";

import { useSearchCatalogPending } from "@/components/marketing/search-catalog-client";
import { SORT_OPTIONS, type SearchSortValue } from "@/components/marketing/search-sort-select";
import { cn } from "@auction/ui";
import { usePathname, useSearchParams } from "next/navigation";

function buildHref(pathname: string, searchParams: URLSearchParams, sort: SearchSortValue): string {
  const next = new URLSearchParams(searchParams.toString());
  next.set("offset", "0");
  if (sort === "endingAsc") next.delete("sort");
  else next.set("sort", sort);
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

type Props = {
  value: SearchSortValue;
  onSelect?: () => void;
};

/** Radio-style sort picker for the mobile filter sheet. */
export function SearchSortSheetGroup({ value, onSelect }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { pending, navigate } = useSearchCatalogPending();

  return (
    <fieldset className="space-y-2" disabled={pending}>
      <legend className="mb-2 font-label text-xs uppercase tracking-widest text-secondary">
        Sort by
      </legend>
      {SORT_OPTIONS.map((opt) => {
        const checked = value === opt.value;
        return (
          <label
            key={opt.value}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 font-body text-sm transition-colors",
              checked
                ? "border-primary bg-primary/10 text-on-surface"
                : "border-outline-variant/40 text-on-surface-variant hover:border-primary/30",
            )}
          >
            <input
              type="radio"
              name="search-sort"
              value={opt.value}
              checked={checked}
              className="size-4 accent-primary"
              onChange={() => {
                navigate(buildHref(pathname, searchParams, opt.value));
                onSelect?.();
              }}
            />
            {opt.label}
          </label>
        );
      })}
    </fieldset>
  );
}
