"use client";

import { HelpCategoryDialog } from "@/components/help/help-category-dialog.client";
import {
  HelpDeleteDialog,
  HelpPublicationDialog,
  type HelpSubject,
  useHelpReorder,
} from "@/components/help/help-confirm-dialogs.client";
import { knownFacts, useWorkList } from "@/components/use-work-list.client";
import { type HelpCategoryListRow, helpCategoriesList } from "@/server/domain/help-list.vm";
import { presentStatus } from "@/server/domain/staff-status";
import type { WorkListState } from "@/server/domain/work-list.vm";
import {
  type DataColumn,
  DetailPanel,
  ListPage,
  MappedStatusBadge,
  type OverflowAction,
  PrimaryCell,
  StaffButton,
  StaffDate,
  formatStaffDateTime,
} from "@auction/staff-ui";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  ListOrdered,
  PanelRight,
  Pencil,
  Plus,
  Trash2,
} from "@auction/staff-ui/icons";
import { useMemo, useState } from "react";

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
 * categories with counts, a search by title and a record panel linked from the URL
 * (`?category=`). The order is the one lax.art shows; Move up and Move down change it while the
 * whole list is in view. Create and edit are a dialog, so the list is never left.
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
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const opened = rows.find((row) => row.id === list.panel.openId) ?? null;
  // The API stores the whole order, so a move needs every category in view.
  const reorderable = state.view === "all" && !state.q;
  const reorder = useHelpReorder({ ids: rows.map((row) => row.id) });

  const columns = useMemo<DataColumn<HelpCategoryListRow>[]>(
    () => [
      {
        id: "title",
        header: "Category",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell
            href={list.panelHref(row.id)}
            Link={list.panel.PanelLink}
            secondary={`/${row.slug}`}
          >
            {row.title}
          </PrimaryCell>
        ),
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
    [list.panelHref, list.panel.PanelLink],
  );

  const openDialog = (next: Dialog) => setDialog(next);
  const questionsHref = (row: HelpCategoryListRow) => `/help?category=${row.id}`;

  const rowActions = (row: HelpCategoryListRow): OverflowAction[] => {
    const index = rows.findIndex((item) => item.id === row.id);
    const publish = row.status !== "published";
    return [
      {
        id: "open",
        label: "Open details",
        icon: PanelRight,
        onSelect: () => list.panel.show(row.id),
      },
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
          onRowOpen: (row) => list.panel.show(row.id),
          activeRowId: list.panel.openId,
          rowActions: {
            label: (row) => `Actions for ${row.title}`,
            actions: rowActions,
          },
        }}
      />

      <DetailPanel
        open={opened !== null}
        onOpenChange={(open) => {
          if (!open) list.panel.show(null);
        }}
        title={opened?.title ?? "Category"}
        status={
          opened ? <MappedStatusBadge status={opened.status} present={presentHelpStatus} /> : null
        }
        meta={
          opened
            ? [
                { label: "Questions", value: opened.counts },
                {
                  label: "Updated",
                  value: formatStaffDateTime(opened.updatedAt, { zoneLabel: true }),
                },
              ]
            : []
        }
        headerActions={
          opened ? (
            <StaffButton asChild variant="ghost" size="sm" icon={<ListOrdered aria-hidden />}>
              <list.Link href={questionsHref(opened)}>View questions</list.Link>
            </StaffButton>
          ) : null
        }
        summary={
          opened
            ? knownFacts([
                { label: "Slug", value: `/${opened.slug}`, copyValue: opened.slug },
                { label: "Category ID", value: opened.id, copyValue: opened.id },
              ])
            : []
        }
        footer={
          opened ? (
            <>
              <StaffButton
                variant="secondary"
                requires="editorial.publish"
                icon={opened.status === "published" ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                onClick={() =>
                  openDialog({
                    kind: "publish",
                    row: opened,
                    publish: opened.status !== "published",
                  })
                }
              >
                {opened.status === "published" ? "Unpublish" : "Publish"}
              </StaffButton>
              <StaffButton
                variant="primary"
                requires="editorial.write"
                icon={<Pencil aria-hidden />}
                onClick={() => openDialog({ kind: "form", row: opened })}
              >
                Edit
              </StaffButton>
            </>
          ) : null
        }
      >
        {null}
      </DetailPanel>

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
        <HelpDeleteDialog
          subject={subjectOf(dialog.row)}
          onClose={() => setDialog(null)}
          onDeleted={() => {
            if (list.panel.openId === dialog.row.id) list.panel.show(null);
          }}
        />
      ) : null}
    </>
  );
}
