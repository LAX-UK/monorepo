"use client";

import { CategoryQuickView } from "@/components/admin/categories/category-quick-view";
import { useCategoryActions } from "@/components/admin/categories/use-category-actions";
import { useListPanel } from "@/components/admin/staff/use-list-panel";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  type CategoriesListSearch,
  type CategoriesStaffRow,
  categoriesListHref,
  categoryPanelHref,
} from "@/lib/admin/categories/categories-staff-list.vm";
import { useViewerCapabilities } from "@/lib/auth/capabilities/viewer-capabilities-context";
import { CATEGORIES_ACCESS } from "@/lib/navigation/staff-nav-access";
import {
  type DataColumn,
  DataViews,
  ListPage,
  type Metric,
  PrimaryCell,
  StaffButton,
  type DataView as StaffDataView,
  StaffDate,
  StatusBadge,
  TableSearch,
  searchChipLabel,
} from "@auction/staff-ui";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo } from "react";

export type CategoriesStaffListProps = {
  rows: CategoriesStaffRow[];
  search: CategoriesListSearch;
  views: StaffDataView[];
  activeView: string;
  metrics: Metric[] | null;
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  listError: string | null;
  filtered: boolean;
};

const count = new Intl.NumberFormat("en-GB");

/**
 * Bid's catalogue taxonomy on the staff list template: active or all categories with counts,
 * search, and a record panel deep-linked with `?category=`. Every row's `…` menu opens the
 * category, its page and editor, and archives or deletes it after a confirmation.
 */
export function CategoriesStaffList(props: CategoriesStaffListProps) {
  const { rows, search } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const panelHref = useCallback((id: string | null) => categoryPanelHref(search, id), [search]);
  const panel = useListPanel({
    param: "category",
    initialId: typeof search.category === "string" ? search.category : null,
    hrefFor: panelHref,
  });
  const categoryActions = useCategoryActions();
  // Read-only staff see the list without creating, editing, archiving or deleting.
  const canManage = useViewerCapabilities().can(CATEGORIES_ACCESS);
  const q = typeof search.q === "string" ? search.q : "";

  const columns = useMemo<DataColumn<CategoriesStaffRow>[]>(
    () => [
      {
        id: "category",
        header: "Category",
        mobile: "title",
        // Taxonomy order: each parent, then its sub-categories, as the API returns them.
        sortable: true,
        sortValue: (row) => rows.indexOf(row),
        cell: (row) => (
          <PrimaryCell href={panelHref(row.id)} Link={panel.PanelLink} secondary={row.context}>
            {row.name}
          </PrimaryCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "132px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge>,
      },
      {
        id: "lots",
        header: "Lots",
        sortable: true,
        sortValue: (row) => row.lots,
        defaultSortDirection: "desc",
        width: "88px",
        numeric: true,
        mobile: "meta",
        cell: (row) => count.format(row.lots),
      },
      {
        id: "sales",
        header: "Sales",
        sortable: true,
        sortValue: (row) => row.sales,
        defaultSortDirection: "desc",
        width: "88px",
        numeric: true,
        hideBelow: "md",
        mobile: "hidden",
        cell: (row) => count.format(row.sales),
      },
      {
        id: "submissions",
        header: "Submissions",
        sortable: true,
        sortValue: (row) => row.submissions,
        defaultSortDirection: "desc",
        width: "120px",
        numeric: true,
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => count.format(row.submissions),
      },
      {
        id: "updated",
        header: "Updated",
        sortable: true,
        sortValue: (row) => row.updatedAt,
        defaultSortDirection: "desc",
        width: "120px",
        hideBelow: "xl",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StaffDate value={row.updatedAt} />,
      },
    ],
    [panelHref, panel.PanelLink, rows],
  );

  const openRow = rows.find((row) => row.id === panel.openId) ?? null;

  return (
    <>
      <ListPage<CategoriesStaffRow>
        title="Categories"
        description="The taxonomy behind sales, lots and submissions. Archive a category in use instead of deleting it."
        Link={ListLink}
        listKey="bid-admin.categories"
        access={canManage ? "full" : "read-only"}
        primaryAction={
          <StaffButton asChild variant="primary" size="sm" icon={<Plus aria-hidden />}>
            <Link href="/admin/categories/new">New category</Link>
          </StaffButton>
        }
        {...(props.metrics
          ? {
              metrics: {
                label: "Categories summary",
                period: "All categories",
                items: props.metrics,
              },
            }
          : {})}
        views={<DataViews views={props.views} activeId={props.activeView} Link={ListLink} />}
        search={
          <TableSearch
            key={q}
            fullWidth
            label="Search categories"
            placeholder="Search by name or slug"
            value={q}
            onSearch={(next) => navigate(categoriesListHref(search, { q: next || null }))}
          />
        }
        activeFilters={
          q
            ? [
                {
                  id: "q",
                  label: searchChipLabel(q),
                  onRemove: () => navigate(categoriesListHref(search, { q: null })),
                },
              ]
            : []
        }
        onClearFilters={() => navigate(categoriesListHref(search, { q: null }))}
        loading={pending}
        filtered={props.filtered}
        error={
          props.listError
            ? {
                description: props.listError,
                onRetry: () => navigate(categoriesListHref(search, {})),
              }
            : null
        }
        empty={{
          title: "No categories yet",
          description: "Create categories before cataloguing lots or building sale landing pages.",
          action: (
            <StaffButton asChild size="sm" variant="primary">
              <Link href="/admin/categories/new">New category</Link>
            </StaffButton>
          ),
        }}
        noResults={{ noun: "categories" }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.id,
          defaultDensity: "comfortable",
          defaultHiddenColumns: ["updated"],
          defaultSort: { columnId: "category", direction: "asc" },
          onRowOpen: (row) => panel.show(row.id),
          activeRowId: panel.openId,
          rowActions: {
            label: (row) => `Actions for category ${row.name}`,
            actions: (row) => [
              { id: "open", label: "Open details", onSelect: () => panel.show(row.id) },
              { id: "page", label: "Open category page", href: row.href },
              ...(canManage
                ? [
                    { id: "edit", label: "Edit category", href: row.editHref },
                    ...categoryActions.actionsFor(row),
                  ]
                : []),
            ],
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(categoriesListHref(search, { limit: size })),
        }}
        pagination={props.pagination}
      />
      <CategoryQuickView
        row={openRow}
        onClose={() => panel.show(null)}
        actions={openRow && canManage ? categoryActions.actionsFor(openRow) : []}
      />
      {categoryActions.dialogs}
    </>
  );
}
