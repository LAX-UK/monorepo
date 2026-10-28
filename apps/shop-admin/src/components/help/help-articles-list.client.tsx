"use client";

import { HelpCategoryDialog } from "@/components/help/help-category-dialog.client";
import {
  HelpDeleteDialog,
  HelpPublicationDialog,
  type HelpSubject,
  useHelpReorder,
} from "@/components/help/help-confirm-dialogs.client";
import { filterChip, knownFacts, useWorkList } from "@/components/use-work-list.client";
import {
  type HelpArticleListRow,
  type HelpArticlesState,
  helpArticlesList,
} from "@/server/domain/help-list.vm";
import { presentStatus } from "@/server/domain/staff-status";
import {
  type DataColumn,
  DetailPanel,
  FilterSheet,
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
  PanelRight,
  Pencil,
  Plus,
  Trash2,
} from "@auction/staff-ui/icons";
import { useMemo, useState } from "react";

const presentHelpStatus = presentStatus("help");

export type HelpCategoryOption = { id: string; title: string };

type Dialog =
  | { kind: "publish"; row: HelpArticleListRow; publish: boolean }
  | { kind: "delete"; row: HelpArticleListRow }
  | { kind: "category" };

const subjectOf = (row: HelpArticleListRow): HelpSubject => ({
  kind: "question",
  id: row.id,
  title: row.question,
});

/**
 * Help centre questions on the staff list template: a view for all, published and draft
 * questions with counts, a search of questions and answers, a category filter by name and a
 * record panel linked from the URL (`?article=`). The order is the one lax.art shows, so there
 * is no sort; Move up and Move down appear when the list is one whole category. The list is
 * unpaged: the API returns every question up to a fixed limit.
 */
export function HelpArticlesList({
  state,
  rows,
  counts,
  categories,
  artPublicUrl,
  loadFailed = false,
}: {
  state: HelpArticlesState;
  /** The questions of the current view, in lax.art order. */
  rows: HelpArticleListRow[];
  /** Questions per status under the search and category, for the view tabs. */
  counts: Record<string, number>;
  categories: HelpCategoryOption[];
  artPublicUrl: string | null;
  loadFailed?: boolean;
}) {
  const list = useWorkList({
    list: helpArticlesList,
    state,
    page: { items: rows, nextCursor: null, counts },
    noun: { one: "question", other: "questions" },
    search: { label: "Search questions", placeholder: "Search questions and answers" },
  });
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const opened = rows.find((row) => row.id === list.panel.openId) ?? null;
  const category = state.filters.category;
  const categoryTitle = (id: string) =>
    categories.find((item) => item.id === id)?.title ?? "Category";
  // Order only means something on one whole category: no search, no status view.
  const reorderable = Boolean(category) && !state.q && state.view === "all";
  const reorder = useHelpReorder({ ids: rows.map((row) => row.id), categoryId: category ?? null });
  const addressOf = (row: HelpArticleListRow) =>
    `${artPublicUrl ? artPublicUrl.replace(/\/$/, "") : ""}/help/${row.slug}`;
  const newHref = category ? `/help/new?category=${category}` : "/help/new";
  const editHref = (row: HelpArticleListRow) => `/help/${row.id}`;

  const columns = useMemo<DataColumn<HelpArticleListRow>[]>(
    () => [
      {
        id: "question",
        header: "Question",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell
            href={list.panelHref(row.id)}
            Link={list.panel.PanelLink}
            secondary={`/${row.slug}`}
          >
            {row.question}
          </PrimaryCell>
        ),
      },
      {
        id: "category",
        header: "Category",
        width: "22%",
        mobile: "meta",
        cell: (row) => row.categoryTitle,
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
        id: "updated",
        header: "Updated",
        width: "184px",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.updatedAt} withTime />,
      },
    ],
    [list.panelHref, list.panel.PanelLink],
  );

  const publishAction = (row: HelpArticleListRow): OverflowAction => {
    const publish = row.status !== "published";
    return {
      id: "publication",
      label: publish ? "Publish…" : "Unpublish…",
      requires: "editorial.publish",
      icon: publish ? Eye : EyeOff,
      onSelect: () => setDialog({ kind: "publish", row, publish }),
    };
  };

  const rowActions = (row: HelpArticleListRow): OverflowAction[] => {
    const index = rows.findIndex((item) => item.id === row.id);
    return [
      {
        id: "open",
        label: "Open details",
        icon: PanelRight,
        onSelect: () => list.panel.show(row.id),
      },
      { id: "edit", label: "Edit", icon: Pencil, href: editHref(row) },
      ...(reorderable
        ? [
            {
              id: "up",
              label: "Move up",
              icon: ArrowUp,
              disabled: reorder.pending || index === 0,
              onSelect: () => void reorder.move(row.id, "up"),
            },
            {
              id: "down",
              label: "Move down",
              icon: ArrowDown,
              disabled: reorder.pending || index === rows.length - 1,
              onSelect: () => void reorder.move(row.id, "down"),
            },
          ]
        : []),
      publishAction(row),
      {
        id: "delete",
        label: "Delete…",
        icon: Trash2,
        tone: "danger",
        onSelect: () => setDialog({ kind: "delete", row }),
      },
    ];
  };

  const categoryChip = filterChip(
    helpArticlesList,
    state,
    list.navigate,
    "category",
    (id) => `Category: ${categoryTitle(id)}`,
  );

  const emptyTitle =
    state.view === "draft"
      ? "No draft questions"
      : state.view === "published"
        ? "No published questions"
        : "No questions yet";
  const noCategories = categories.length === 0;

  // Every question needs a category, so with none the page offers the category first.
  const createAction = noCategories ? (
    <StaffButton
      variant="primary"
      icon={<Plus aria-hidden />}
      onClick={() => setDialog({ kind: "category" })}
    >
      New category
    </StaffButton>
  ) : (
    <StaffButton asChild variant="primary" icon={<Plus aria-hidden />}>
      <list.Link href={newHref}>New question</list.Link>
    </StaffButton>
  );
  // An empty list says what will appear and offers the one action that creates it; the header
  // takes the action back once there is something to list.
  const isEmptyList = rows.length === 0 && state.view === "all" && !list.filtered;

  return (
    <>
      <ListPage<HelpArticleListRow>
        title="Help centre"
        description="Questions and answers shown on lax.art, in the order readers see them."
        Link={list.Link}
        listKey="lax-admin.help-articles"
        primaryAction={isEmptyList ? undefined : createAction}
        secondaryActions={
          <StaffButton asChild variant="secondary">
            <list.Link href="/help/categories">Categories</list.Link>
          </StaffButton>
        }
        views={list.views}
        search={list.search}
        filters={
          <FilterSheet
            title="Filter questions"
            sections={[
              {
                kind: "entity",
                id: "category",
                label: "Category",
                value: category ?? "",
                options: categories.map((item) => ({ id: item.id, label: item.title })),
                placeholder: "Any category",
                searchPlaceholder: "Search categories",
                emptyText: "No category with that name",
              },
            ]}
            onApply={(values) =>
              list.navigate(
                helpArticlesList.href(state, { category: (values.category as string) || null }),
              )
            }
          />
        }
        activeFilters={[...list.searchChip, ...categoryChip]}
        onClearFilters={list.clearFilters}
        loading={list.pending}
        filtered={list.filtered}
        error={
          loadFailed
            ? {
                title: "Questions did not load",
                description: "Something went wrong on our side. Try again in a moment.",
                onRetry: () => list.navigate(helpArticlesList.href(state)),
              }
            : null
        }
        empty={{
          illustration: "frame",
          title: noCategories ? "Create a category first" : emptyTitle,
          description: noCategories
            ? "Every question belongs to a category. Create one, then add questions to it."
            : state.view === "all"
              ? "Add the first question as a draft, then publish it when it is ready."
              : "Questions appear here as they are published or saved as drafts.",
          ...(state.view === "all" ? { action: createAction } : {}),
        }}
        noResults={{ noun: "questions" }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.id,
          defaultDensity: "comfortable",
          onRowOpen: (row) => list.panel.show(row.id),
          activeRowId: list.panel.openId,
          rowActions: {
            label: (row) => `Actions for ${row.question}`,
            actions: rowActions,
          },
        }}
      />

      <DetailPanel
        open={opened !== null}
        onOpenChange={(open) => {
          if (!open) list.panel.show(null);
        }}
        title={opened?.question ?? "Question"}
        status={
          opened ? <MappedStatusBadge status={opened.status} present={presentHelpStatus} /> : null
        }
        meta={
          opened
            ? [
                { label: "Category", value: opened.categoryTitle },
                {
                  label: "Updated",
                  value: formatStaffDateTime(opened.updatedAt, { zoneLabel: true }),
                },
              ]
            : []
        }
        summary={
          opened
            ? knownFacts([
                { label: "Last changed by", value: opened.updatedByName },
                {
                  label:
                    opened.status === "published" ? "Public address" : "Address once published",
                  value: addressOf(opened),
                  copyValue: addressOf(opened),
                },
                { label: "Question ID", value: opened.id, copyValue: opened.id },
              ])
            : []
        }
        footer={
          opened ? (
            <>
              <StaffButton
                variant="secondary"
                icon={opened.status === "published" ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                onClick={() =>
                  setDialog({
                    kind: "publish",
                    row: opened,
                    publish: opened.status !== "published",
                  })
                }
              >
                {opened.status === "published" ? "Unpublish" : "Publish"}
              </StaffButton>
              <StaffButton asChild variant="primary" icon={<Pencil aria-hidden />}>
                <list.Link href={editHref(opened)}>Edit</list.Link>
              </StaffButton>
            </>
          ) : null
        }
      >
        {null}
      </DetailPanel>

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
      {dialog?.kind === "category" ? (
        <HelpCategoryDialog category={null} onClose={() => setDialog(null)} />
      ) : null}
    </>
  );
}
