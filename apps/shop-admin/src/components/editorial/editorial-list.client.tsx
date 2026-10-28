"use client";

import { useAdminAction } from "@/components/use-admin-action.client";
import { filterChip, knownFacts, useWorkList } from "@/components/use-work-list.client";
import type { EditorialEntityCopy } from "@/lib/editorial-entities";
import type { EditorialEntityKind } from "@/lib/editorial-entity-forms";
import { editorialMutationErrorMessage } from "@/lib/editorial-mutation-message";
import { buildEditorialPreviewUrl } from "@/lib/editorial-preview";
import {
  issueEditorialPreviewToken,
  setEditorialPublication,
} from "@/server/application/admin-editorial-actions.server";
import {
  type EditorialListPage,
  type EditorialListRow,
  type EditorialListState,
  editorialKindOptions,
  editorialList,
} from "@/server/domain/editorial-list.vm";
import {
  editorialPublicAddress,
  publicationDialogCopy,
} from "@/server/domain/editorial-publication.vm";
import { presentStatus } from "@/server/domain/staff-status";
import {
  ConfirmActionDialog,
  type DataColumn,
  DetailPanel,
  EmptyValue,
  FilterSheet,
  ListPage,
  MappedStatusBadge,
  type OverflowAction,
  PrimaryCell,
  StaffButton,
  StaffDate,
  formatStaffDateTime,
  toast,
} from "@auction/staff-ui";
import { Eye, EyeOff, Link as LinkIcon, PanelRight, Pencil, Plus } from "@auction/staff-ui/icons";
import { useMemo, useState } from "react";

const presentEditorialStatus = presentStatus("editorial");

const KIND_FILTER_LABELS: Partial<Record<EditorialEntityKind, string>> = {
  exhibitions: "Kind",
  stories: "Kind",
};

/**
 * One editorial entity on the staff list template: a view per publication status with counts,
 * search by title or address, a kind filter where the entity has kinds, sorting by title or
 * last update, 50 rows a page, and a record panel linked from the URL (`?item=`). Publish and
 * unpublish ask first and say what changes on lax.art. The API returns every row, so all of it
 * runs over the full set.
 */
export function EditorialList({
  kind,
  entity,
  state,
  page,
  totalRows,
  initialOpened = null,
  artPublicUrl,
  loadFailed = false,
}: {
  kind: EditorialEntityKind;
  entity: EditorialEntityCopy;
  state: EditorialListState;
  page: EditorialListPage;
  /** Every row of the entity, before search and filters: tells an empty entity from no matches. */
  totalRows: number;
  /** The record named in `?item=` when it is not on this page, so a shared link still opens it. */
  initialOpened?: EditorialListRow | null;
  artPublicUrl: string | null;
  loadFailed?: boolean;
}) {
  const definition = editorialList(kind);
  const list = useWorkList({
    list: definition,
    state,
    page: {
      items: page.items,
      nextCursor: page.hasNext ? String(page.page + 1) : null,
      counts: page.counts,
    },
    noun: { one: entity.singular, other: `${entity.singular}s` },
    search: {
      label: `Search ${entity.title.toLowerCase()}`,
      placeholder: "Search by title or slug",
    },
  });
  const action = useAdminAction();
  const [confirming, setConfirming] = useState<{ row: EditorialListRow; publish: boolean } | null>(
    null,
  );
  const opened =
    page.items.find((row) => row.id === list.panel.openId) ??
    (initialOpened?.id === list.panel.openId ? initialOpened : null);
  const kindOptions = editorialKindOptions(kind);
  const hasKind = kindOptions.length > 0;
  const hasDates = kind === "exhibitions";
  const hasCity = kind === "venues";
  const newHref = `/editorial/${kind}/new`;
  const editHref = (row: EditorialListRow) => `/editorial/${kind}/${row.id}`;
  const addressOf = (row: EditorialListRow) => editorialPublicAddress(kind, row.slug, artPublicUrl);

  const columns = useMemo<DataColumn<EditorialListRow>[]>(
    () => [
      {
        id: "title",
        header: kind === "venues" ? "Name" : "Title",
        mobile: "title",
        sortable: true,
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
      ...(hasKind
        ? [
            {
              id: "kind",
              header: "Kind",
              width: "136px",
              mobile: "meta",
              cell: (row) => row.kindLabel ?? <EmptyValue />,
            } satisfies DataColumn<EditorialListRow>,
          ]
        : []),
      ...(hasCity
        ? [
            {
              id: "city",
              header: "City",
              width: "160px",
              mobile: "meta",
              cell: (row) => row.city ?? <EmptyValue />,
            } satisfies DataColumn<EditorialListRow>,
          ]
        : []),
      {
        id: "status",
        header: "Status",
        width: "128px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <MappedStatusBadge status={row.status} present={presentEditorialStatus} />,
      },
      ...(hasDates
        ? [
            {
              id: "dates",
              header: "Dates",
              width: "232px",
              hideBelow: "lg",
              mobile: "meta",
              cell: (row) => row.dates ?? <EmptyValue />,
            } satisfies DataColumn<EditorialListRow>,
          ]
        : []),
      {
        id: "updated",
        header: "Updated",
        width: "184px",
        sortable: true,
        defaultSortDirection: "desc",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.updatedAt} withTime />,
      },
    ],
    [kind, hasKind, hasCity, hasDates, list.panelHref, list.panel.PanelLink],
  );

  async function createPreview(row: EditorialListRow) {
    const result = await issueEditorialPreviewToken({
      kind,
      id: row.id,
      idempotencyKey: crypto.randomUUID(),
    }).catch(() => ({ ok: false, kind: "failed", message: "" }) as const);
    if (!result.ok) {
      toast.error(editorialMutationErrorMessage(result, "create a preview link"));
      return;
    }
    const url = buildEditorialPreviewUrl(artPublicUrl, result.data.token);
    if (!url) {
      toast.error("The lax.art address is not set up here, so a preview link cannot be opened.");
      return;
    }
    toast.success(`Preview of “${row.title}” is ready`, {
      description: `The link works until ${formatStaffDateTime(result.data.expiresAt, { zoneLabel: true })}.`,
      action: {
        label: "Open preview",
        onClick: () => window.open(url, "_blank", "noopener,noreferrer"),
      },
    });
  }

  const rowActions = (row: EditorialListRow): OverflowAction[] => [
    {
      id: "open",
      label: "Open details",
      icon: PanelRight,
      onSelect: () => list.panel.show(row.id),
    },
    { id: "edit", label: "Edit", icon: Pencil, href: editHref(row) },
    {
      id: "preview",
      label: "Preview on lax.art",
      icon: LinkIcon,
      onSelect: () => void createPreview(row),
    },
    row.status === "published"
      ? {
          id: "unpublish",
          requires: "editorial.publish",
          label: "Unpublish…",
          icon: EyeOff,
          tone: "danger",
          onSelect: () => setConfirming({ row, publish: false }),
        }
      : {
          id: "publish",
          requires: "editorial.publish",
          label: "Publish…",
          icon: Eye,
          onSelect: () => setConfirming({ row, publish: true }),
        },
  ];

  const activeKind = state.filters.kind;
  const kindLabel = (value: string) =>
    kindOptions.find((option) => option.value === value)?.label ?? value;
  const copy = confirming
    ? publicationDialogCopy({
        publish: confirming.publish,
        noun: entity.singular,
        name: confirming.row.title,
        address: addressOf(confirming.row),
      })
    : null;

  return (
    <>
      <ListPage<EditorialListRow>
        title={entity.title}
        description={entity.description}
        Link={list.Link}
        listKey={`lax-admin.editorial.${kind}`}
        primaryAction={
          <StaffButton
            asChild
            variant="primary"
            requires="editorial.write"
            icon={<Plus aria-hidden />}
          >
            <list.Link href={newHref}>{entity.newLabel}</list.Link>
          </StaffButton>
        }
        views={list.views}
        search={list.search}
        filters={
          hasKind ? (
            <FilterSheet
              title={`Filter ${entity.title.toLowerCase()}`}
              sections={[
                {
                  kind: "radio",
                  id: "kind",
                  label: KIND_FILTER_LABELS[kind] ?? "Kind",
                  options: kindOptions,
                  value: activeKind ?? "",
                  anyLabel: "Any kind",
                },
              ]}
              onApply={(values) => {
                const next = values.kind;
                list.navigate(
                  definition.href(state, { kind: typeof next === "string" && next ? next : null }),
                );
              }}
            />
          ) : undefined
        }
        activeFilters={[
          ...list.searchChip,
          ...filterChip(definition, state, list.navigate, "kind", kindLabel),
        ]}
        onClearFilters={list.clearFilters}
        loading={list.pending}
        filtered={list.filtered}
        error={
          loadFailed
            ? {
                title: `${entity.title} did not load`,
                description: "Something went wrong on our side. Try again in a moment.",
                onRetry: () => list.navigate(definition.href(state)),
              }
            : null
        }
        empty={{
          illustration: "frame",
          title: totalRows === 0 ? entity.empty.title : `No ${entity.title.toLowerCase()} here`,
          description:
            totalRows === 0
              ? entity.empty.description
              : state.view === "published"
                ? `Nothing is published yet. ${entity.title} appear here once you publish them.`
                : `${entity.title} you have not published yet appear here.`,
          action:
            totalRows === 0 ? (
              <StaffButton asChild size="sm" variant="primary" icon={<Plus aria-hidden />}>
                <list.Link href={newHref}>{entity.newLabel}</list.Link>
              </StaffButton>
            ) : undefined,
        }}
        noResults={{ noun: `${entity.title.toLowerCase()}` }}
        table={{
          columns,
          data: page.items,
          getRowId: (row) => row.id,
          defaultDensity: "comfortable",
          ...list.sort,
          onRowOpen: (row) => list.panel.show(row.id),
          activeRowId: list.panel.openId,
          rowActions: {
            label: (row) => `Actions for ${row.title}`,
            actions: rowActions,
          },
        }}
        pageSize={list.pageSize}
        pagination={
          page.items.length > 0
            ? {
                summary: `${page.range.from}–${page.range.to} of ${page.total}`,
                prevHref: page.hasPrevious
                  ? page.page === 2
                    ? definition.href(state)
                    : definition.pageHref(state, String(page.page - 1))
                  : null,
                nextHref: page.hasNext ? definition.pageHref(state, String(page.page + 1)) : null,
              }
            : null
        }
      />

      <DetailPanel
        open={opened !== null}
        onOpenChange={(open) => {
          if (!open) list.panel.show(null);
        }}
        title={opened?.title ?? entity.singular}
        status={
          opened ? (
            <MappedStatusBadge status={opened.status} present={presentEditorialStatus} />
          ) : null
        }
        summary={
          opened
            ? knownFacts([
                { label: "Kind", value: opened.kindLabel },
                { label: "City", value: opened.city },
                { label: "Dates", value: opened.dates },
                {
                  label: "Updated",
                  value: formatStaffDateTime(opened.updatedAt, { zoneLabel: true }),
                },
                {
                  label: "Public address",
                  value:
                    addressOf(opened) === null
                      ? null
                      : opened.status === "published"
                        ? addressOf(opened)
                        : "Not public yet",
                  ...(opened.status === "published" && addressOf(opened)
                    ? { copyValue: addressOf(opened) as string }
                    : {}),
                },
                {
                  label: `${entity.singular.charAt(0).toUpperCase()}${entity.singular.slice(1)} ID`,
                  value: opened.id,
                  copyValue: opened.id,
                },
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
                  setConfirming({ row: opened, publish: opened.status !== "published" })
                }
              >
                {opened.status === "published" ? "Unpublish" : "Publish"}
              </StaffButton>
              <StaffButton asChild variant="primary" icon={<Pencil aria-hidden />}>
                <list.Link href={editHref(opened)}>Edit {entity.singular}</list.Link>
              </StaffButton>
            </>
          ) : null
        }
      >
        {null}
      </DetailPanel>

      <ConfirmActionDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={copy?.title ?? ""}
        description={copy?.description ?? ""}
        confirmLabel={copy?.confirmLabel ?? ""}
        tone={confirming && !confirming.publish ? "danger" : "default"}
        loading={action.pending}
        onConfirm={async () => {
          if (!confirming) return;
          const { row, publish } = confirming;
          const ok = await action.run(
            () =>
              setEditorialPublication({
                kind,
                id: row.id,
                published: publish,
                idempotencyKey: action.idempotencyKey,
              }),
            publish ? `Published “${row.title}”` : `Unpublished “${row.title}”`,
            publish ? `publish this ${entity.singular}` : `unpublish this ${entity.singular}`,
          );
          if (ok) setConfirming(null);
        }}
      >
        {action.error}
      </ConfirmActionDialog>
      {action.stepUpDialog}
    </>
  );
}
