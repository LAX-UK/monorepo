"use client";

import { ArtworkThumbnail } from "@/components/artworks/artwork-thumbnail";
import { SetFactsDialog } from "@/components/artworks/edition-runs/set-facts-dialog.client";
import { useListNavigation } from "@/components/use-list-navigation.client";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  bulkArtworkVisibility,
  searchArtistOptions,
} from "@/server/application/admin-artwork-actions.server";
import {
  ARTWORK_DEFAULT_SORT,
  ARTWORK_STATE_LABELS,
  ARTWORK_VIEW_ORDER,
  type ArtworkListQuery,
  CHANNEL_LABELS,
  FACTS_FILTER_LABEL,
  SALE_STATE_LABELS,
  VISIBILITY_ACTION_LABELS,
  artworkListHref,
  artworkListPageHref,
  artworkPageSize,
  artworkPriceLabel,
  artworkRecordHref,
  artworkSortParam,
  artworkSortState,
  bulkVisibilityActions,
  editionSizeLabel,
  hasActiveArtworkFilters,
  releaseAlertChoice,
  summariseBulkVisibility,
  visibilityConfirmCopy,
} from "@/server/domain/artwork-list.vm";
import { factsListLabel } from "@/server/domain/edition-run.vm";
import { presentStatus } from "@/server/domain/staff-status";
import { pageSummary } from "@/server/domain/work-list.vm";
import {
  ADMIN_ARTWORK_CHANNELS,
  ADMIN_ARTWORK_SALE_STATES,
  type AdminArtworkChannel,
  type AdminArtworkList,
  type AdminArtworkListItem,
  type AdminArtworkSaleState,
  type AdminArtworkVisibilityAction,
} from "@auction/shop-contracts";
import {
  type ActiveFilter,
  ChoiceRow,
  ConfirmActionDialog,
  type DataColumn,
  DataViews,
  FilterSheet,
  ListPage,
  MappedStatusBadge,
  type OverflowAction,
  OverflowMenu,
  PrimaryCell,
  StaffButton,
  StaffCheckbox,
  StaffDate,
  type StaffLinkComponent,
  StatusBadge,
  TableSearch,
  searchChipLabel,
  toast,
} from "@auction/staff-ui";
import {
  Archive,
  ArchiveRestore,
  ClipboardCheck,
  Eye,
  EyeOff,
  FileInput,
  PenLine,
  Plus,
} from "@auction/staff-ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useId, useMemo, useState } from "react";

const NextLink: StaffLinkComponent = Link;

const presentArtworkStatus = presentStatus("artwork");

const ACTION_ICON: Record<AdminArtworkVisibilityAction, typeof Eye> = {
  publish: Eye,
  unpublish: EyeOff,
  archive: Archive,
  restore: ArchiveRestore,
};

export type ArtworkListPermissions = {
  /** `catalogue.write`: publish, unpublish, archive and create. */
  write: boolean;
};

type PendingChange = {
  action: AdminArtworkVisibilityAction;
  rows: (Pick<AdminArtworkListItem, "artworkId" | "title" | "salesChannel"> & { run: unknown })[];
};

/**
 * The artwork list on the staff list template: views by state with counts, search by title or
 * artist, a filter sheet for artist, sale state and channel, last changed first on the server,
 * and a row that opens the artwork's page. Publishing, unpublishing, archiving and
 * restoring, one row or a selection, ask first and say what the storefront shows afterwards.
 */
export function ArtworkList({
  query,
  page,
  selectedArtistName,
  permissions,
  loadFailed = false,
}: {
  query: ArtworkListQuery;
  page: AdminArtworkList;
  /** The filtered artist's name, for the filter sheet and its chip. */
  selectedArtistName: string | null;
  permissions: ArtworkListPermissions;
  loadFailed?: boolean;
}) {
  const router = useRouter();
  const { pending, navigate, Link: ListLink } = useListNavigation();
  const rowHref = useCallback(
    (row: AdminArtworkListItem) => artworkRecordHref(query, row.artworkId),
    [query],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [change, setChange] = useState<PendingChange | null>(null);
  const [running, setRunning] = useState(false);
  const [tellSubscribers, setTellSubscribers] = useState(true);
  const tellSubscribersId = useId();
  const [settingFacts, setSettingFacts] = useState<AdminArtworkListItem[] | null>(null);
  const filtered = hasActiveArtworkFilters(query);
  const counts = page.counts;
  const total = counts ? Object.values(counts).reduce((sum, count) => sum + count, 0) : undefined;

  const views = (
    <DataViews
      activeId={query.state ?? "all"}
      Link={ListLink}
      views={[
        {
          id: "all",
          label: "All",
          href: artworkListHref(query, { state: null }),
          ...(total !== undefined ? { count: total } : {}),
        },
        ...ARTWORK_VIEW_ORDER.map((state) => ({
          id: state,
          label: ARTWORK_STATE_LABELS[state],
          href: artworkListHref(query, { state }),
          ...(counts ? { count: counts[state] } : {}),
        })),
      ]}
    />
  );

  const titleOf = (artworkId: string) =>
    change?.rows.find((row) => row.artworkId === artworkId)?.title ??
    page.items.find((item) => item.artworkId === artworkId)?.title ??
    "An artwork";

  async function apply(pendingChange: PendingChange) {
    setRunning(true);
    const result = await bulkArtworkVisibility({
      action: pendingChange.action,
      artworkIds: pendingChange.rows.map((row) => row.artworkId),
      idempotencyKey: crypto.randomUUID(),
      sendReleaseAlert:
        pendingChange.action === "publish" &&
        releaseAlertChoice(pendingChange.rows) !== null &&
        tellSubscribers,
    }).catch(() => ({ ok: false, kind: "failed", message: "Action failed. Try again." }) as const);
    setRunning(false);
    setChange(null);
    setTellSubscribers(true);
    if (!result.ok) {
      toast.error(adminMutationErrorMessage(result));
      return;
    }
    const summary = summariseBulkVisibility(pendingChange.action, result.data, titleOf);
    if (summary.tone === "success") toast.success(summary.message);
    else toast.warning(summary.message, { description: summary.refusals.join(" ") });
    setSelected(new Set());
    router.refresh();
  }

  const columns = useMemo<DataColumn<AdminArtworkListItem>[]>(
    () => [
      {
        id: "thumbnail",
        header: "Image",
        width: "64px",
        mobile: "hidden",
        cell: (row) => <ArtworkThumbnail url={row.thumbnailUrl} />,
      },
      {
        id: "title",
        header: "Title",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell href={rowHref(row)} Link={NextLink} secondary={row.artistName}>
            {row.title}
          </PrimaryCell>
        ),
      },
      {
        id: "edition",
        header: "Run",
        width: "168px",
        hideBelow: "lg",
        mobile: "meta",
        cell: (row) =>
          row.run && row.soldEditionCount > 0
            ? `${editionSizeLabel(row)} · ${row.soldEditionCount} sold`
            : editionSizeLabel(row),
      },
      {
        id: "facts",
        header: "Edition facts",
        width: "136px",
        hideBelow: "xl",
        mobile: "hidden",
        truncate: false,
        cell: (row) =>
          row.run ? (
            <StatusBadge tone={row.run.factsStatus === "confirmed" ? "neutral" : "warning"}>
              {factsListLabel(row.run)}
            </StatusBadge>
          ) : null,
      },
      {
        id: "price",
        header: "Edition price",
        width: "136px",
        numeric: true,
        mobile: "meta",
        cell: (row) => artworkPriceLabel(row),
      },
      {
        id: "channel",
        header: "Sold on",
        width: "112px",
        hideBelow: "xl",
        mobile: "hidden",
        cell: (row) => CHANNEL_LABELS[row.salesChannel],
      },
      {
        id: "state",
        header: "Status",
        width: "120px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <MappedStatusBadge status={row.state} present={presentArtworkStatus} />,
      },
      {
        id: "updated",
        header: "Last changed",
        width: "184px",
        sortable: true,
        defaultSortDirection: "desc",
        hideBelow: "lg",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StaffDate value={row.updatedAt} withTime />,
      },
    ],
    [rowHref],
  );

  const visibilityActions = (row: AdminArtworkListItem): OverflowAction[] =>
    permissions.write
      ? bulkVisibilityActions([row]).map((action) => ({
          id: action,
          label: `${VISIBILITY_ACTION_LABELS[action].verb}…`,
          icon: ACTION_ICON[action],
          ...(action === "archive" ? { tone: "danger" as const } : {}),
          onSelect: () => setChange({ action, rows: [row] }),
        }))
      : [];

  const chips: ActiveFilter[] = [
    ...(query.q
      ? [
          {
            id: "q",
            label: searchChipLabel(query.q),
            onRemove: () => navigate(artworkListHref(query, { q: null })),
          },
        ]
      : []),
    ...(query.artist
      ? [
          {
            id: "artist",
            label: `Artist: ${selectedArtistName ?? "Selected artist"}`,
            onRemove: () => navigate(artworkListHref(query, { artist: null })),
          },
        ]
      : []),
    ...(query.sale
      ? [
          {
            id: "sale",
            label: `Sale: ${SALE_STATE_LABELS[query.sale]}`,
            onRemove: () => navigate(artworkListHref(query, { sale: null })),
          },
        ]
      : []),
    ...(query.channel
      ? [
          {
            id: "channel",
            label: `Sold on: ${CHANNEL_LABELS[query.channel]}`,
            onRemove: () => navigate(artworkListHref(query, { channel: null })),
          },
        ]
      : []),
    ...(query.facts
      ? [
          {
            id: "facts",
            label: FACTS_FILTER_LABEL,
            onRemove: () => navigate(artworkListHref(query, { facts: null })),
          },
        ]
      : []),
  ];

  const newArtwork = permissions.write ? (
    <StaffButton asChild variant="primary" icon={<Plus aria-hidden />}>
      <Link href="/artworks/new">New artwork</Link>
    </StaffButton>
  ) : undefined;

  const confirm = change ? visibilityConfirmCopy(change.action, change.rows) : null;
  const releaseChoice = change?.action === "publish" ? releaseAlertChoice(change.rows) : null;

  return (
    <>
      <ListPage<AdminArtworkListItem>
        title="Artworks"
        description="Every artwork on LAX Shop and lax.art, drafts and archived works included. Open one to edit its details, price, images and visibility."
        access={permissions.write ? "full" : "read-only"}
        primaryAction={newArtwork}
        overflow={
          permissions.write ? (
            <OverflowMenu
              Link={NextLink}
              label="More artwork actions"
              actions={[
                {
                  id: "import",
                  label: "Import by catalogue key",
                  icon: FileInput,
                  href: "/artworks/import",
                },
              ]}
            />
          ) : undefined
        }
        Link={ListLink}
        listKey="lax-admin.artworks"
        views={views}
        search={
          <TableSearch
            key={query.q ?? ""}
            fullWidth
            label="Search artworks"
            placeholder="Search by title or artist"
            value={query.q ?? ""}
            onSearch={(q) => navigate(artworkListHref(query, { q: q.slice(0, 100) || null }))}
          />
        }
        filters={
          <FilterSheet
            title="Filter artworks"
            sections={[
              {
                kind: "entity",
                id: "artist",
                label: "Artist",
                value: query.artist ?? "",
                search: searchArtistOptions,
                selected:
                  query.artist && selectedArtistName
                    ? { id: query.artist, label: selectedArtistName }
                    : null,
                placeholder: "Any artist",
                searchPlaceholder: "Search by name",
                emptyText: "No artists match.",
              },
              {
                kind: "radio",
                id: "sale",
                label: "Sale",
                anyLabel: "Any sale state",
                options: ADMIN_ARTWORK_SALE_STATES.map((value) => ({
                  value,
                  label: SALE_STATE_LABELS[value],
                })),
                value: query.sale ?? "",
              },
              {
                kind: "radio",
                id: "channel",
                label: "Sold on",
                anyLabel: "Either storefront",
                options: ADMIN_ARTWORK_CHANNELS.map((value) => ({
                  value,
                  label: CHANNEL_LABELS[value],
                })),
                value: query.channel ?? "",
              },
              {
                kind: "radio",
                id: "facts",
                label: "Edition facts",
                anyLabel: "Any",
                options: [{ value: "needs_review", label: "Needs review" }],
                value: query.facts ?? "",
              },
            ]}
            onApply={(values) =>
              navigate(
                artworkListHref(query, {
                  artist: (values.artist as string) || null,
                  sale: ((values.sale as string) || null) as AdminArtworkSaleState | null,
                  channel: ((values.channel as string) || null) as AdminArtworkChannel | null,
                  facts: values.facts === "needs_review" ? "needs_review" : null,
                }),
              )
            }
          />
        }
        activeFilters={chips}
        onClearFilters={() =>
          navigate(artworkListHref({ ...(query.state ? { state: query.state } : {}) }))
        }
        loading={pending}
        filtered={filtered}
        error={
          loadFailed
            ? {
                title: "Artworks did not load",
                description: "Something went wrong on our side. Try again in a moment.",
                onRetry: () => navigate(artworkListHref(query)),
              }
            : null
        }
        empty={
          query.state
            ? {
                illustration: "easel",
                title: `No ${ARTWORK_STATE_LABELS[query.state].toLowerCase()} artworks`,
                description: "Artworks move here as they are published, sell out or are archived.",
              }
            : {
                illustration: "easel",
                title: "No artworks yet",
                description: "Add the first artwork; it starts as a draft until you publish it.",
                action: newArtwork,
              }
        }
        noResults={{ noun: "artworks" }}
        table={{
          columns,
          data: page.items,
          getRowId: (row) => row.artworkId,
          defaultDensity: "comfortable",
          defaultSort: ARTWORK_DEFAULT_SORT,
          sort: artworkSortState(query),
          onSortChange: (sort) =>
            navigate(artworkListHref(query, { sort: artworkSortParam(sort) })),
          rowHref,
          rowActions: {
            label: (row) => `Actions for ${row.title}`,
            actions: (row) => [
              {
                id: "edit",
                label: permissions.write ? "Edit artwork" : "Open artwork",
                icon: PenLine,
                href: rowHref(row),
              },
              ...visibilityActions(row),
            ],
          },
          ...(permissions.write
            ? {
                selectedIds: selected,
                onSelectedIdsChange: setSelected,
                bulkNoun: { one: "artwork", other: "artworks" },
                bulkActions: (rows: AdminArtworkListItem[]) => [
                  ...bulkVisibilityActions(rows).map((action) => {
                    const Icon = ACTION_ICON[action];
                    return (
                      <StaffButton
                        key={action}
                        size="sm"
                        variant="ghost"
                        icon={<Icon aria-hidden />}
                        disabled={running}
                        onClick={() => setChange({ action, rows })}
                      >
                        {VISIBILITY_ACTION_LABELS[action].verb}…
                      </StaffButton>
                    );
                  }),
                  ...(rows.some((row) => row.run !== null)
                    ? [
                        <StaffButton
                          key="set-facts"
                          size="sm"
                          variant="ghost"
                          icon={<ClipboardCheck aria-hidden />}
                          disabled={running}
                          onClick={() => setSettingFacts(rows)}
                        >
                          Set edition facts…
                        </StaffButton>,
                      ]
                    : []),
                ],
              }
            : {}),
        }}
        pageSize={{
          value: artworkPageSize(query),
          onChange: (size) =>
            navigate(artworkListHref(query, { limit: size === 50 ? null : String(size) })),
        }}
        pagination={
          page.items.length > 0
            ? {
                summary: pageSummary(page.items.length, { one: "artwork", other: "artworks" }),
                prevHref: query.cursor ? artworkListHref(query) : null,
                prevLabel: "First page",
                nextHref: page.nextCursor ? artworkListPageHref(query, page.nextCursor) : null,
              }
            : null
        }
      />
      {settingFacts ? (
        <SetFactsDialog
          open
          onOpenChange={(open) => {
            if (!open) setSettingFacts(null);
          }}
          rows={settingFacts}
          onDone={() => {
            setSelected(new Set());
            router.refresh();
          }}
        />
      ) : null}
      <ConfirmActionDialog
        open={change !== null}
        onOpenChange={(open) => {
          if (!open && !running) {
            setChange(null);
            setTellSubscribers(true);
          }
        }}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        confirmLabel={confirm?.confirmLabel ?? ""}
        tone={confirm?.tone ?? "default"}
        loading={running}
        onConfirm={() => {
          if (change) void apply(change);
        }}
      >
        {releaseChoice ? (
          <ChoiceRow
            htmlFor={tellSubscribersId}
            disabled={running}
            control={
              <StaffCheckbox
                id={tellSubscribersId}
                checked={tellSubscribers}
                disabled={running}
                onCheckedChange={(checked) => setTellSubscribers(checked === true)}
              />
            }
            label={releaseChoice.label}
            description={releaseChoice.description}
          />
        ) : null}
      </ConfirmActionDialog>
    </>
  );
}
