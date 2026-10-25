"use client";

import { useListNavigation } from "@/components/use-list-navigation.client";
import { useListPanel } from "@/components/use-list-panel.client";
import { type WorkList, type WorkListState, pageSummary } from "@/server/domain/work-list.vm";
import { type ActiveFilter, DataViews, type SortState, TableSearch } from "@auction/staff-ui";
import { useCallback, useMemo } from "react";

type Page = {
  items: readonly unknown[];
  nextCursor: string | null;
  counts?: Record<string, number>;
};

/**
 * Everything a sales or operations list shares, from its URL state: the view tabs with counts,
 * the search, the server sort, 50 rows a page with the size in Display, pagination, the search
 * chip and clearing, and the record panel linked from the URL. Moves run in a transition, so the
 * table dims its rows while the next page loads.
 */
export function useWorkList<F extends string>({
  list,
  state,
  page,
  noun,
  search,
}: {
  list: WorkList<F>;
  state: WorkListState<F>;
  page: Page;
  noun: { one: string; other: string };
  search: { label: string; placeholder: string };
}) {
  const { pending, navigate, Link } = useListNavigation();
  const panelHref = useCallback((id: string | null) => list.panelHref(state, id), [list, state]);
  const panel = useListPanel({
    param: list.config.panelParam,
    initialId: state.open,
    hrefFor: panelHref,
  });

  const clearFilters = useCallback(() => {
    const cleared = Object.fromEntries(
      Object.keys(list.config.filters).map((id) => [id, null]),
    ) as { [K in F]?: null };
    navigate(list.href(state, { q: null, ...cleared }));
  }, [list, navigate, state]);

  const searchChip: ActiveFilter[] = state.q
    ? [{ id: "q", label: `“${state.q}”`, onRemove: () => navigate(list.href(state, { q: null })) }]
    : [];

  const views = useMemo(
    () => <DataViews views={list.views(state, page.counts)} activeId={state.view} Link={Link} />,
    [list, state, page.counts, Link],
  );

  const searchField = (
    <TableSearch
      key={state.q ?? ""}
      fullWidth
      label={search.label}
      placeholder={search.placeholder}
      value={state.q ?? ""}
      onSearch={(q) =>
        navigate(list.href(state, { q: q.slice(0, list.config.searchMaxLength) || null }))
      }
    />
  );

  return {
    pending,
    navigate,
    Link,
    panel,
    panelHref,
    views,
    search: searchField,
    searchChip,
    clearFilters,
    filtered: list.filtered(state),
    sort: {
      defaultSort: list.defaultSortState() as SortState,
      sort: list.sortState(state) as SortState,
      onSortChange: (sort: SortState) => navigate(list.href(state, { sort: list.sortParam(sort) })),
    },
    pageSize: {
      value: list.pageSize(state),
      onChange: (size: number) =>
        navigate(list.href(state, { limit: size === 50 ? null : String(size) })),
    },
    pagination:
      page.items.length > 0
        ? {
            summary: pageSummary(page.items.length, noun),
            prevHref: state.cursor ? list.href(state) : null,
            prevLabel: "First page",
            nextHref: page.nextCursor ? list.pageHref(state, page.nextCursor) : null,
          }
        : null,
  };
}

/** A chip for one applied filter, which removes just that filter. */
export function filterChip<F extends string>(
  list: WorkList<F>,
  state: WorkListState<F>,
  navigate: (href: string) => void,
  id: F,
  label: (value: string) => string,
): ActiveFilter[] {
  const value = state.filters[id];
  if (!value) return [];
  return [
    {
      id,
      label: label(value),
      onRemove: () => navigate(list.href(state, { [id]: null } as { [K in F]?: null })),
    },
  ];
}
