"use client";

import { ARTWORK_SORT_OPTIONS } from "@/lib/catalogue/artwork-catalogue-filter-config";
import type { ArtworkCatalogueSort } from "@/lib/catalogue/artwork-catalogue-params";
import { type SearchUrlState, searchFilterHref } from "@/lib/search/search-params";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** "Sorted by" control for the artwork tabs (Figma `826:14746`); sorting restarts paging. */
export function ArtSearchSort({ state }: { state: SearchUrlState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1">
      <span id="art-search-sort-label" className="font-body text-xs text-on-surface-variant">
        Sorted by:
      </span>
      <Select
        value={state.sort}
        disabled={pending}
        onValueChange={(value) =>
          startTransition(() =>
            router.push(searchFilterHref(state, { sort: value as ArtworkCatalogueSort })),
          )
        }
      >
        <SelectTrigger
          aria-labelledby="art-search-sort-label"
          data-testid="art-search-sort"
          className="min-h-11 w-auto gap-2 border-0 bg-transparent px-1 font-body text-sm text-on-surface shadow-none"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ARTWORK_SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
