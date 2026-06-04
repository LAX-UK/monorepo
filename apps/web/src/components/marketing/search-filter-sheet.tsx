"use client";

import { MarketingFilterSheet } from "@/components/marketing/marketing-filter-sheet";
import { MarketingFilterTrigger } from "@/components/marketing/marketing-filter-trigger";
import { SaveSearchButton } from "@/components/marketing/save-search-button";
import { useSearchCatalogPending } from "@/components/marketing/search-catalog-client";
import { SearchCategoryChips } from "@/components/marketing/search-category-chips";
import { SearchFilterForm } from "@/components/marketing/search-filter-form";
import type { SearchSortValue } from "@/components/marketing/search-sort-select";
import { SearchSortSheetGroup } from "@/components/marketing/search-sort-sheet-group";
import { SearchStatusChips } from "@/components/marketing/search-status-chips";
import type { SearchEndingWindow } from "@/lib/marketing/parse-search-params";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import type { Category, LotStatus } from "@auction/types";
import { useCallback, useId, useState } from "react";

const SEARCH_FILTER_FORM_ID = "search-filter-sheet-form";

export type SearchFilterSheetProps = {
  activeCount: number;
  initialQ: string;
  sort: SearchSortValue;
  categoryId?: string | undefined;
  view: CatalogLayoutView;
  categories: Category[];
  trimmed: string;
  resultCountLabel: string;
  status?: LotStatus;
  ending?: SearchEndingWindow;
};

/** Mobile filter sheet + trigger for `/search`. */
export function SearchFilterSheet({
  activeCount,
  initialQ,
  sort,
  categoryId,
  view,
  categories,
  trimmed,
  resultCountLabel,
  status,
  ending,
}: SearchFilterSheetProps) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const resolvedFormId = `${SEARCH_FILTER_FORM_ID}-${formId}`;
  const { navigate } = useSearchCatalogPending();

  const close = useCallback(() => setOpen(false), []);

  return (
    <MarketingFilterSheet
      open={open}
      onOpenChange={setOpen}
      title="Filters"
      trigger={<MarketingFilterTrigger activeCount={activeCount} />}
      applyLabel={resultCountLabel}
      onApply={() => {
        const el = document.getElementById(resolvedFormId) as HTMLFormElement | null;
        el?.requestSubmit();
      }}
      onReset={() => {
        navigate("/search");
        close();
      }}
    >
      <div className="flex flex-col gap-8">
        <SearchFilterForm
          formId={resolvedFormId}
          variant="sheet"
          initialQ={initialQ}
          sort={sort}
          categoryId={categoryId}
          view={view}
          {...(status ? { status } : {})}
          {...(ending ? { ending } : {})}
          inputId={`${resolvedFormId}-q`}
          onSubmitted={close}
        />
        <div>
          <p className="mb-3 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Status
          </p>
          <SearchStatusChips
            layout="list"
            trimmed={trimmed}
            sort={sort}
            view={view}
            categoryId={categoryId}
            {...(status ? { status } : {})}
            {...(ending ? { ending } : {})}
          />
        </div>
        {categories.length > 0 ? (
          <div>
            <p className="mb-3 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              Category
            </p>
            <SearchCategoryChips
              layout="list"
              categories={categories}
              categoryId={categoryId}
              trimmed={trimmed}
              sort={sort}
              view={view}
              {...(status ? { status } : {})}
              {...(ending ? { ending } : {})}
            />
          </div>
        ) : null}
        <SearchSortSheetGroup value={sort} onSelect={close} />
        <SaveSearchButton
          label={trimmed ? `Search: ${trimmed}` : "Catalogue search"}
          query={{
            ...(trimmed ? { q: trimmed } : {}),
            sort,
            view,
            ...(categoryId ? { categoryId } : {}),
            ...(status ? { status } : {}),
            ...(ending ? { ending } : {}),
          }}
        />
      </div>
    </MarketingFilterSheet>
  );
}
