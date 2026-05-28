"use client";

import {
  DashboardActiveFilters,
  DashboardFilterChipRow,
  DashboardFilterSection,
  DashboardFilterSheet,
  DashboardFilterTrigger,
  DashboardListToolbar,
  DashboardMultiSelectSection,
  DashboardSearchField,
  DashboardSortSelect,
  useFilterSheetDraft,
} from "@/components/dashboard/filters";
import {
  WATCHLIST_BASE_PATH,
  WATCHLIST_INLINE_CATEGORY_THRESHOLD,
  WATCHLIST_SORT_OPTIONS,
  WATCHLIST_STATUS_OPTIONS,
  type WatchlistFilters,
  type WatchlistSortOption,
  buildWatchlistHref,
  countWatchlistMobileSheetFilters,
  countWatchlistSheetFilters,
  getWatchlistActiveFilters,
  toggleWatchlistCategory,
} from "@/lib/dashboard/filters/watchlist/watchlist-filters";
import { FilterChip } from "@auction/ui";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

type WatchlistDraft = {
  categoryIds: string[];
  sort: WatchlistSortOption;
};

const WATCHLIST_DRAFT_DEFAULTS: WatchlistDraft = {
  categoryIds: [],
  sort: "addedDesc",
};

type Category = { id: string; name: string };

type Props = {
  filters: WatchlistFilters;
  categories: readonly Category[];
};

export function WatchlistListToolbar({ filters, categories }: Props) {
  const router = useRouter();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [desktopSheetOpen, setDesktopSheetOpen] = useState(false);
  const fromFilters = useCallback(
    (): WatchlistDraft => ({ categoryIds: filters.categoryIds, sort: filters.sort }),
    [filters.categoryIds, filters.sort],
  );
  const { draft, setDraft, resetDraft } = useFilterSheetDraft({
    mobileOpen: mobileSheetOpen,
    desktopOpen: desktopSheetOpen,
    fromFilters,
    defaultDraft: WATCHLIST_DRAFT_DEFAULTS,
  });

  const categoryNames = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const activeFilters = useMemo(
    () => getWatchlistActiveFilters(filters, categoryNames),
    [categoryNames, filters],
  );

  const mobileSheetCount = countWatchlistMobileSheetFilters(filters);
  const desktopSheetCount = countWatchlistSheetFilters(filters);
  const useCategorySheet = categories.length > WATCHLIST_INLINE_CATEGORY_THRESHOLD;

  const statusItems = WATCHLIST_STATUS_OPTIONS.map((opt) => ({
    id: opt.value,
    label: opt.label,
    href: buildWatchlistHref(filters, {
      status: filters.status === opt.value ? null : opt.value,
    }),
    active: filters.status === opt.value,
  }));

  const statusFilterRow = <DashboardFilterChipRow label="Status" items={statusItems} />;

  const navigateSort = useCallback(
    (value: string) => {
      router.replace(buildWatchlistHref(filters, { sort: value as WatchlistFilters["sort"] }), {
        scroll: false,
      });
    },
    [filters, router],
  );

  const applyMobileDraft = useCallback(() => {
    router.replace(
      buildWatchlistHref(filters, { categoryIds: draft.categoryIds, sort: draft.sort }),
      { scroll: false },
    );
    setMobileSheetOpen(false);
  }, [draft.categoryIds, draft.sort, filters, router]);

  const applyCategoryDraft = useCallback(() => {
    router.replace(buildWatchlistHref(filters, { categoryIds: draft.categoryIds }), {
      scroll: false,
    });
    setDesktopSheetOpen(false);
  }, [draft.categoryIds, filters, router]);

  const categoryMultiSelect =
    categories.length > 0 ? (
      <DashboardMultiSelectSection
        label="Category"
        options={categories.map((c) => ({ id: c.id, label: c.name }))}
        selectedIds={draft.categoryIds}
        onToggle={(id) =>
          setDraft((current) => ({
            ...current,
            categoryIds: toggleWatchlistCategory(
              { ...filters, categoryIds: current.categoryIds },
              id,
            ).categoryIds,
          }))
        }
      />
    ) : null;

  const sortDraftSection = (
    <DashboardFilterSection label="Sort by">
      <div className="flex flex-wrap gap-2">
        {WATCHLIST_SORT_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            pressed={draft.sort === opt.value}
            onClick={() => setDraft((current) => ({ ...current, sort: opt.value }))}
          >
            {opt.label}
          </FilterChip>
        ))}
      </div>
    </DashboardFilterSection>
  );

  const mobileFilterSheet = (
    <DashboardFilterSheet
      open={mobileSheetOpen}
      onOpenChange={setMobileSheetOpen}
      title="Watchlist filters"
      onApply={applyMobileDraft}
      onReset={resetDraft}
      trigger={<DashboardFilterTrigger activeCount={mobileSheetCount} />}
    >
      <div className="space-y-6">
        {statusFilterRow}
        {sortDraftSection}
        {categoryMultiSelect}
      </div>
    </DashboardFilterSheet>
  );

  const desktopCategorySheet =
    categories.length > 0 && useCategorySheet ? (
      <DashboardFilterSheet
        open={desktopSheetOpen}
        onOpenChange={setDesktopSheetOpen}
        title="Watchlist filters"
        onApply={applyCategoryDraft}
        onReset={resetDraft}
        trigger={<DashboardFilterTrigger activeCount={desktopSheetCount} />}
      >
        {categoryMultiSelect}
      </DashboardFilterSheet>
    ) : null;

  const inlineCategories =
    !useCategorySheet && categories.length > 0 ? (
      <DashboardFilterChipRow
        label="Category"
        items={categories.map((category) => {
          const active = filters.categoryIds.includes(category.id);
          const nextIds = toggleWatchlistCategory(filters, category.id).categoryIds;
          return {
            id: category.id,
            label: category.name,
            href: buildWatchlistHref(filters, { categoryIds: nextIds }),
            active,
          };
        })}
      />
    ) : null;

  return (
    <div className="space-y-3">
      <DashboardListToolbar
        searchLabel="Filter watchlist"
        search={
          <DashboardSearchField
            initialQ={filters.q}
            label="Filter by lot title"
            placeholder="e.g. oil on canvas"
            inputId="watchlist-q"
          />
        }
        primaryFilters={
          <div className="space-y-3">
            {statusFilterRow}
            {inlineCategories}
          </div>
        }
        sort={
          <DashboardSortSelect
            label="Sort"
            value={filters.sort}
            options={WATCHLIST_SORT_OPTIONS}
            onValueChange={navigateSort}
          />
        }
        hideSortOnMobile
        mobileFilterSheet={mobileFilterSheet}
        filterSheet={desktopCategorySheet}
      />
      <DashboardActiveFilters filters={activeFilters} clearAllHref={WATCHLIST_BASE_PATH} />
    </div>
  );
}
