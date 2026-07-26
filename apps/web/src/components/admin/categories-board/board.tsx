"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { CatalogBoardCard } from "@/components/admin/catalog/catalog-board-card";
import { CatalogBoardTableHeader } from "@/components/admin/catalog/catalog-board-table-header";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import type {
  CatalogTableFilterControlsBaseProps,
  CatalogTableFilterControlsProps,
} from "@/components/admin/catalog/catalog-table-filter-controls";
import { categoryColumns } from "@/components/admin/categories-board/columns";
import { CategoriesMobileList } from "@/components/admin/categories-board/mobile-list";
import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { useTableDensity } from "@/components/layout/density-provider";
import {
  adminArchiveCategoryResultAction,
  adminDeleteCategoryResultAction,
} from "@/lib/actions/admin";
import { flattenCategoryTaxonomyRows } from "@/lib/admin/categories/category-taxonomy-rows";
import { notify } from "@/lib/ui/notify";
import type { AdminCategory } from "@auction/types";
import { EntityList } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export type CategoriesBoardPagination = {
  offset: number;
  limit: number;
  countOnPage: number;
  total?: number;
  prevHref: string | null;
  nextHref: string | null;
};

type Props = {
  categories: AdminCategory[];
  searchQuery?: string;
  filterControls?: CatalogTableFilterControlsBaseProps;
  pagination?: CategoriesBoardPagination | null;
  /** Total categories in current lens (for header count badge). */
  listTotalCount?: number;
};

type PendingAction = {
  category: AdminCategory;
  action: "archive" | "delete";
};

export function AdminCategoriesBoard({
  categories,
  searchQuery = "",
  filterControls,
  pagination,
  listTotalCount,
}: Props) {
  const router = useRouter();
  const { density } = useTableDensity();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<PendingAction | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => flattenCategoryTaxonomyRows(categories), [categories]);

  const tableFilterControls = useMemo((): CatalogTableFilterControlsProps | undefined => {
    if (!filterControls) return undefined;
    return {
      ...filterControls,
      sheetFilters: (
        <p className="font-body text-sm text-on-surface-variant">
          Search runs server-side across names and slugs. Use the archive lens above to include
          archived categories in results.
        </p>
      ),
    };
  }, [filterControls]);

  const columns = useMemo(
    () =>
      categoryColumns({
        pending,
        pendingId,
        onRequestAction: (category, action) => setConfirmAction({ category, action }),
      }),
    [pending, pendingId],
  );

  const headerCount = listTotalCount ?? categories.length;

  if (categories.length === 0) {
    return null;
  }

  const runAction = (category: AdminCategory, action: "archive" | "delete") => {
    startTransition(async () => {
      setPendingId(category.id);
      const result =
        action === "archive"
          ? await adminArchiveCategoryResultAction(category.id)
          : await adminDeleteCategoryResultAction(category.id);
      setPendingId(null);
      setConfirmAction(null);
      if (result.ok) {
        notify.success(action === "archive" ? "Category archived" : "Category deleted");
        router.refresh();
        return;
      }
      notify.error(result.error);
    });
  };

  return (
    <>
      <CatalogBoardCard>
        <CatalogBoardTableHeader
          leading={
            <>
              <h2 className="font-headline text-base font-semibold text-on-surface sm:text-lg">
                Categories
              </h2>
              <Badge
                variant="secondary"
                className="h-6 min-w-6 rounded-full bg-on-surface px-2 font-label text-xs font-semibold text-surface-container-lowest"
              >
                {headerCount > 99 ? "99+" : headerCount}
              </Badge>
            </>
          }
          {...(tableFilterControls ? { filterControls: tableFilterControls } : {})}
        />
        <div className="p-4 sm:p-6">
          <EntityList
            density={density}
            responsiveMode="auto"
            table={
              <AdminDataTable
                ariaLabel="Categories"
                columns={columns}
                data={rows}
                getRowId={(r) => r.id}
                getRowHref={(r) => `/admin/categories/${r.id}`}
                getRowEditHref={(r) => `/admin/categories/${r.id}/edit`}
                density={density}
                stickyHeader
                enableKeyboardNav
                className="[&_table]:border-0"
              />
            }
            cards={<CategoriesMobileList categories={categories} query={searchQuery} />}
          />
        </div>
        {pagination ? (
          <div className="border-t border-shell-stroke px-4 py-3 sm:px-6">
            <CatalogPagination
              offset={pagination.offset}
              limit={pagination.limit}
              countOnPage={pagination.countOnPage}
              prevHref={pagination.prevHref}
              nextHref={pagination.nextHref}
              {...(pagination.total != null
                ? { total: pagination.total }
                : listTotalCount != null
                  ? { total: listTotalCount }
                  : {})}
            />
          </div>
        ) : null}
      </CatalogBoardCard>
      {confirmAction ? (
        <TypedConfirmationDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmAction(null);
          }}
          title={
            confirmAction.action === "archive" ? "Archive this category?" : "Delete this category?"
          }
          description={
            confirmAction.action === "archive"
              ? "Archived categories stay in the tree but are hidden from new assignments."
              : "This permanently removes an unused category. This cannot be undone."
          }
          actionLabel={confirmAction.action === "archive" ? "Archive" : "Delete"}
          confirmationPhrase={confirmAction.category.slug}
          severity={confirmAction.action === "delete" ? "danger" : "warning"}
          onConfirm={() => runAction(confirmAction.category, confirmAction.action)}
        />
      ) : null}
    </>
  );
}
