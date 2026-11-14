"use client";

import { HelpCategoryDialog } from "@/components/help/help-category-dialog.client";
import {
  HelpDeleteDialog,
  HelpPublicationDialog,
  type HelpSubject,
  useHelpReorder,
} from "@/components/help/help-confirm-dialogs.client";
import { useWorkList } from "@/components/use-work-list.client";
import { type HelpCategoryListRow, helpCategoriesList } from "@/server/domain/help-list.vm";
import { presentStatus } from "@/server/domain/staff-status";
import type { WorkListState } from "@/server/domain/work-list.vm";
import {
  type DataColumn,
  ListPage,
  MappedStatusBadge,
  type OverflowAction,
  PrimaryCell,
  StaffButton,
  StaffDate,
  useStaffCan,
} from "@auction/staff-ui";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  ListOrdered,
  Pencil,
  Plus,
  Trash2,
} from "@auction/staff-ui/icons";
import { useEffect, useMemo, useState } from "react";

const presentHelpStatus = presentStatus("help");

type Dialog =
  | { kind: "form"; row: HelpCategoryListRow | null }
  | { kind: "publish"; row: HelpCategoryListRow; publish: boolean }
  | { kind: "delete"; row: HelpCategoryListRow };

const subjectOf = (row: HelpCategoryListRow): HelpSubject => ({
  kind: "category",
  id: row.id,
  title: row.title,
});

/**
 * Help centre categories on the staff list template: a view for all, published and draft
 * categories with counts and a search by title. A category has no page: a row opens its edit
 * dialog, as Framing does, so the list is never left. The order is the one lax.art shows; Move up
 * and Move down change it while the whole list is in view.
 */
export function HelpCategoriesList({
  state,
  rows,
  counts,
  loadFailed = false,
}: {
  state: WorkListState;
  /** The categories of the current view and search, in lax.art order. */
  rows: HelpCategoryListRow[];
  /** Categories per status under the search, for the view tabs. */
  counts: Record<string, number>;
  loadFailed?: boolean;
}) {
  const list = useWorkList({
    list: helpCategoriesList,
    state,
    page: { items: rows, nextCursor: null, counts },
    noun: { one: "category", other: "categories" },
    search: { label: "Search categories", placeholder: "Search by title" },
  });
  const canWrite = useStaffCan("editorial.write");
  // An old link to the category panel (`?category=`) opens that category's edit dialog instead.
  const linked = canWrite ? (rows.find((row) => row.id === state.open) ?? null) : null;
  const [dialog, setDialog] = useState<Dialog | null>(
    linked ? { kind: "form", row: linked } : null,
  );
  useEffect(() => {
    if (!state.open) return;
    // The dialog is not part of the address: drop the old panel param, keeping the list as it is.
    window.history.replaceState(window.history.state, "", helpCategoriesList.href(state));
  }, [state]);
  // The API stores the whole order, so a move needs every category in view.
  const reorderable = state.view === "all" && !state.q;
  const reorder = useHelpReorder({ ids: rows.map((row) => row.id) });

  const columns = useMemo<DataColumn<HelpCategoryListRow>[]>(
    () => [
      {
        id: "title",
        header: "Category",
        mobile: "title",
        cell: (row) => <PrimaryCell secondary={`/${row.slug}`}>{row.title}</PrimaryCell>,
      },
      {
        id: "status",
        header: "Status",
        width: "128px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <MappedStatusBadge status={row.status} present={presentHelpStatus} />,
      },
      {
        id: "questions",
        header: "Questions",
        width: "26%",
        mobile: "meta",
        cell: (row) => row.counts,
      },
      {
        id: "updated",
        header: "Updated",
        width: "184px",
        hideBelow: "lg",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StaffDate value={row.updatedAt} withTime />,
      },
    ],
    [],
  );

  const openDialog = (next: Dialog) => setDialog(next);
  const questionsHref = (row: HelpCategoryListRow) => `/help?category=${row.id}`;

  const rowActions = (row: HelpCategoryListRow): OverflowAction[] => {
    const index = rows.findIndex((item) => item.id === row.id);
    const publish = row.status !== "published";
    return [
      {
        id: "edit",
        requires: "editorial.write",
        label: "Edit…",
        icon: Pencil,
        onSelect: () => openDialog({ kind: "form", row }),
      },
      { id: "questions", label: "View questions", icon: ListOrdered, href: questionsHref(row) },
      ...(reorderable
        ? [
            {
              id: "up",
              requires: "editorial.write",
              label: "Move up",
              icon: ArrowUp,
              disabled: reorder.pending || index === 0,
              onSelect: () => void reorder.move(row.id, "up"),
            },
            {
              id: "down",
              requires: "editorial.write",
              label: "Move down",
              icon: ArrowDown,
              disabled: reorder.pending || index === rows.length - 1,
              onSelect: () => void reorder.move(row.id, "down"),
            },
          ]
        : []),
      {
        id: "publication",
        label: publish ? "Publish…" : "Unpublish…",
        requires: "editorial.publish",
        icon: publish ? Eye : EyeOff,
        onSelect: () => openDialog({ kind: "publish", row, publish }),
      },
      {
        id: "delete",
        requires: "editorial.write",
        label: "Delete…",
        icon: Trash2,
        tone: "danger",
        disabled: row.articleCount > 0,
        ...(row.articleCount > 0 ? { disabledReason: "Move or delete its questions first" } : {}),
        onSelect: () => openDialog({ kind: "delete", row }),
      },
    ];
  };

  const newCategory = (
    <StaffButton
      variant="primary"
      requires="editorial.write"
      icon={<Plus aria-hidden />}
      onClick={() => openDialog({ kind: "form", row: null })}
    >
      New category
    </StaffButton>
  );

  return (
    <>
      <ListPage<HelpCategoryListRow>
        title="Help centre categories"
        editRequires="editorial.write"
        description="Questions are grouped by category on lax.art, in this order. Only published categories appear."
        Link={list.Link}
        listKey="lax-admin.help-categories"
        primaryAction={newCategory}
        secondaryActions={
          <StaffButton asChild variant="secondary">
            <list.Link href="/help">Questions</list.Link>
          </StaffButton>
        }
        views={list.views}
        search={list.search}
        activeFilters={list.searchChip}
        onClearFilters={list.clearFilters}
        loading={list.pending}
        filtered={list.filtered}
        error={
          loadFailed
            ? {
                title: "Categories did not load",
                description: "Something went wrong on our side. Try again in a moment.",
                onRetry: () => list.navigate(helpCategoriesList.href(state)),
              }
            : null
        }
        empty={{
          illustration: "frame",
          title:
            state.view === "draft"
              ? "No draft categories"
              : state.view === "published"
                ? "No published categories"
                : "No categories yet",
          description:
            state.view === "all"
              ? "Create a category, then add questions to it."
              : "Categories appear here as they are published or saved as drafts.",
          ...(state.view === "all" ? { action: newCategory } : {}),
        }}
        noResults={{ noun: "categories" }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.id,
          defaultDensity: "comfortable",
          // No page to open: an editor's row opens the edit dialog; read-only rows open nothing.
          ...(canWrite
            ? { onRowOpen: (row: HelpCategoryListRow) => openDialog({ kind: "form", row }) }
            : {}),
          rowActions: {
            label: (row) => `Actions for ${row.title}`,
            actions: rowActions,
          },
        }}
      />

      {dialog?.kind === "form" ? (
        <HelpCategoryDialog
          key={dialog.row?.id ?? "new"}
          category={dialog.row}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "publish" ? (
        <HelpPublicationDialog
          subject={subjectOf(dialog.row)}
          publish={dialog.publish}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "delete" ? (
        <HelpDeleteDialog subject={subjectOf(dialog.row)} onClose={() => setDialog(null)} />
      ) : null}
    </>
  );
}
