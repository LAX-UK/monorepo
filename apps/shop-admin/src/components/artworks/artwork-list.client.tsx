"use client";

import { ArtistPicker } from "@/components/artworks/artist-picker.client";
import { ArtworkQuickView } from "@/components/artworks/artwork-quick-view.client";
import { ArtworkThumbnail } from "@/components/artworks/artwork-thumbnail";
import { useListNavigation } from "@/components/use-list-navigation.client";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import { bulkArtworkVisibility } from "@/server/application/admin-artwork-actions.server";
import {
  ARTWORK_LIST_PATH,
  ARTWORK_STATE_LABELS,
  ARTWORK_VIEW_ORDER,
  type ArtworkListQuery,
  CHANNEL_LABELS,
  SALE_STATE_LABELS,
  VISIBILITY_ACTION_LABELS,
  artworkListHref,
  artworkListPageHref,
  artworkPriceLabel,
  bulkVisibilityActions,
  editionSizeLabel,
  hasActiveArtworkFilters,
  presentArtworkState,
  summariseBulkVisibility,
} from "@/server/domain/artwork-list.vm";
import {
  ADMIN_ARTWORK_CHANNELS,
  ADMIN_ARTWORK_SALE_STATES,
  type AdminArtworkList,
  type AdminArtworkListItem,
  type AdminArtworkVisibilityAction,
} from "@auction/shop-contracts";
import {
  ActiveFilterChips,
  ConfirmActionDialog,
  type DataColumn,
  DataTable,
  DataTableToolbar,
  DataViews,
  DensityToggle,
  EmptyState,
  MappedStatusBadge,
  NoResultsState,
  StaffButton,
  StaffMenu,
  StaffMenuCheckboxItem,
  StaffMenuContent,
  StaffMenuLabel,
  StaffMenuTrigger,
  TablePagination,
  TableSearch,
  formatStaffDateTime,
  toast,
  useTableDensity,
} from "@auction/staff-ui";
import { Archive, ArchiveRestore, Eye, EyeOff, Plus, Store, Tag } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";

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

/**
 * The artwork list: views by state with counts, search by title or artist, filters for artist,
 * sale state and channel, a quick view on Enter or click, and bulk publish, unpublish and archive
 * for roles that may change the catalogue. Every filter lives in the URL.
 */
export function ArtworkList({
  query,
  page,
  selectedArtistName,
  permissions,
}: {
  query: ArtworkListQuery;
  page: AdminArtworkList;
  /** The filtered artist's name, for the picker and its chip. */
  selectedArtistName: string | null;
  permissions: ArtworkListPermissions;
}) {
  const router = useRouter();
  const { pending, navigate, Link: ListLink } = useListNavigation();
  const [density, setDensity] = useTableDensity("artworks");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<AdminArtworkListItem[] | null>(null);
  const [running, setRunning] = useState<AdminArtworkVisibilityAction | null>(null);
  const filtered = hasActiveArtworkFilters(query);
  const total = Object.values(page.counts).reduce((sum, count) => sum + count, 0);

  const views = [
    { id: "all", label: "All", href: artworkListHref(query, { state: null }), count: total },
    ...ARTWORK_VIEW_ORDER.map((state) => ({
      id: state,
      label: ARTWORK_STATE_LABELS[state],
      href: artworkListHref(query, { state }),
      count: page.counts[state],
    })),
  ];

  const titleOf = (artworkId: string) =>
    page.items.find((item) => item.artworkId === artworkId)?.title ?? "An artwork";

  async function runBulk(action: AdminArtworkVisibilityAction, rows: AdminArtworkListItem[]) {
    setRunning(action);
    const result = await bulkArtworkVisibility({
      action,
      artworkIds: rows.map((row) => row.artworkId),
      idempotencyKey: crypto.randomUUID(),
    }).catch(() => ({ ok: false, kind: "failed", message: "Action failed. Try again." }) as const);
    setRunning(null);
    setConfirmArchive(null);
    if (!result.ok) {
      toast.error(adminMutationErrorMessage(result));
      return;
    }
    const summary = summariseBulkVisibility(action, result.data, titleOf);
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
        sortable: true,
        sortValue: (row) => row.title.toLowerCase(),
        cell: (row) => (
          <Link
            href={`/artworks/${row.artworkId}`}
            className="staff-focus block min-w-0 truncate rounded-staff-xs font-medium text-staff-fg hover:underline"
          >
            {row.title}
          </Link>
        ),
      },
      {
        id: "artist",
        header: "Artist",
        mobile: "meta",
        sortable: true,
        sortValue: (row) => row.artistName.toLowerCase(),
        cell: (row) => <span className="block truncate">{row.artistName}</span>,
      },
      {
        id: "edition",
        header: "Edition",
        width: "112px",
        numeric: true,
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) =>
          row.editionSize > 0 ? (
            <span className="tabular-nums">
              {row.soldEditionCount}
              <span className="text-staff-muted"> / {editionSizeLabel(row)} sold</span>
            </span>
          ) : (
            <span className="text-staff-muted">{editionSizeLabel(row)}</span>
          ),
      },
      {
        id: "price",
        header: "Price",
        width: "128px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.printPricePence,
        defaultSortDirection: "desc",
        mobile: "meta",
        cell: (row) =>
          row.printPricePence === null ? (
            <span className="text-staff-muted">{artworkPriceLabel(row)}</span>
          ) : (
            artworkPriceLabel(row)
          ),
      },
      {
        id: "state",
        header: "State",
        width: "112px",
        mobile: "badge",
        cell: (row) => <MappedStatusBadge status={row.state} present={presentArtworkState} />,
      },
      {
        id: "updated",
        header: "Updated",
        width: "168px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.updatedAt,
        defaultSortDirection: "desc",
        hideBelow: "xl",
        mobile: "hidden",
        cell: (row) => (
          <time dateTime={row.updatedAt} className="text-staff-muted">
            {formatStaffDateTime(row.updatedAt)}
          </time>
        ),
      },
    ],
    [],
  );

  const activeFilters = [
    ...(query.q
      ? [
          {
            id: "q",
            label: `“${query.q}”`,
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
            label: SALE_STATE_LABELS[query.sale],
            onRemove: () => navigate(artworkListHref(query, { sale: null })),
          },
        ]
      : []),
    ...(query.channel
      ? [
          {
            id: "channel",
            label: CHANNEL_LABELS[query.channel],
            onRemove: () => navigate(artworkListHref(query, { channel: null })),
          },
        ]
      : []),
  ];

  const viewLabel = query.state ? ARTWORK_STATE_LABELS[query.state].toLowerCase() : null;

  return (
    <>
      <DataTable
        label="Artworks"
        columns={columns}
        data={page.items}
        getRowId={(row) => row.artworkId}
        defaultSort={{ columnId: "updated", direction: "desc" }}
        density={density}
        loading={pending}
        onRowOpen={(row) => setOpenId(row.artworkId)}
        activeRowId={openId}
        {...(permissions.write
          ? {
              selectedIds: selected,
              onSelectedIdsChange: setSelected,
              bulkNoun: { one: "artwork", other: "artworks" },
              bulkActions: (rows: AdminArtworkListItem[]) =>
                bulkVisibilityActions(rows).map((action) => {
                  const Icon = ACTION_ICON[action];
                  return (
                    <StaffButton
                      key={action}
                      size="sm"
                      variant="ghost"
                      icon={<Icon aria-hidden />}
                      loading={running === action}
                      disabled={running !== null}
                      onClick={() =>
                        action === "archive" ? setConfirmArchive(rows) : void runBulk(action, rows)
                      }
                    >
                      {VISIBILITY_ACTION_LABELS[action].verb}
                    </StaffButton>
                  );
                }),
            }
          : {})}
        toolbar={
          <DataTableToolbar
            views={<DataViews views={views} activeId={query.state ?? "all"} Link={ListLink} />}
            search={
              <TableSearch
                key={query.q ?? ""}
                label="Search artworks"
                placeholder="Title or artist"
                value={query.q ?? ""}
                onSearch={(q) => navigate(artworkListHref(query, { q: q || null }))}
              />
            }
            filters={
              <>
                <ArtistPicker
                  compact
                  aria-label="Filter by artist"
                  placeholder="Artist"
                  value={query.artist ?? null}
                  selectedName={selectedArtistName}
                  onChange={(artist) =>
                    navigate(artworkListHref(query, { artist: artist?.id ?? null }))
                  }
                />
                <SingleChoiceMenu
                  label="Sale"
                  icon={<Tag aria-hidden />}
                  options={ADMIN_ARTWORK_SALE_STATES}
                  labelOf={(value) => SALE_STATE_LABELS[value]}
                  value={query.sale}
                  onChange={(sale) => navigate(artworkListHref(query, { sale }))}
                />
                <SingleChoiceMenu
                  label="Channel"
                  icon={<Store aria-hidden />}
                  options={ADMIN_ARTWORK_CHANNELS}
                  labelOf={(value) => CHANNEL_LABELS[value]}
                  value={query.channel}
                  onChange={(channel) => navigate(artworkListHref(query, { channel }))}
                />
              </>
            }
            activeFilters={
              <ActiveFilterChips
                filters={activeFilters}
                onClearAll={() =>
                  navigate(artworkListHref({ ...(query.state ? { state: query.state } : {}) }))
                }
              />
            }
            end={<DensityToggle value={density} onChange={setDensity} />}
          />
        }
        empty={
          filtered ? (
            <NoResultsState
              title="No artworks match these filters"
              description="Try another search, artist or channel, or clear the filters."
              action={
                <StaffButton size="sm" onClick={() => navigate(ARTWORK_LIST_PATH)}>
                  Clear filters
                </StaffButton>
              }
            />
          ) : viewLabel ? (
            <EmptyState
              illustration="easel"
              title={`No ${viewLabel} artworks`}
              description="Artworks move here as they are published, sell out or are archived."
            />
          ) : (
            <EmptyState
              illustration="easel"
              title="No artworks yet"
              description="Add the first artwork; it starts as a draft until you publish it."
              action={
                permissions.write ? (
                  <StaffButton asChild size="sm" variant="primary" icon={<Plus aria-hidden />}>
                    <Link href="/artworks/new">New artwork</Link>
                  </StaffButton>
                ) : undefined
              }
            />
          )
        }
        footer={
          page.items.length > 0 ? (
            <TablePagination
              summary={`${page.items.length} ${page.items.length === 1 ? "artwork" : "artworks"} on this page`}
              prevHref={query.cursor ? artworkListHref(query) : null}
              prevLabel="First page"
              nextHref={page.nextCursor ? artworkListPageHref(query, page.nextCursor) : null}
              Link={ListLink}
            />
          ) : null
        }
      />
      <ArtworkQuickView
        artworkId={openId}
        canWrite={permissions.write}
        onClose={() => setOpenId(null)}
      />
      <ConfirmActionDialog
        open={confirmArchive !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmArchive(null);
        }}
        title={`Archive ${confirmArchive?.length ?? 0} ${confirmArchive?.length === 1 ? "artwork" : "artworks"}?`}
        description="Archived artworks leave the storefront and the default views. Editions, orders and sales stay on record, and you can restore an artwork later as a draft."
        confirmLabel="Archive"
        tone="danger"
        loading={running === "archive"}
        onConfirm={() => confirmArchive && void runBulk("archive", confirmArchive)}
      />
    </>
  );
}

/** A single-choice filter as a menu of checked items, like the orders date filter. */
function SingleChoiceMenu<T extends string>({
  label,
  icon,
  options,
  labelOf,
  value,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  options: readonly T[];
  labelOf: (value: T) => string;
  value: T | undefined;
  onChange: (value: T | null) => void;
}) {
  return (
    <StaffMenu>
      <StaffMenuTrigger asChild>
        <StaffButton
          size="sm"
          variant="secondary"
          icon={icon}
          className={value ? "border-staff-line-hover" : undefined}
        >
          {value ? labelOf(value) : label}
        </StaffButton>
      </StaffMenuTrigger>
      <StaffMenuContent align="start" className="w-56">
        <StaffMenuLabel>{label}</StaffMenuLabel>
        {options.map((option) => (
          <StaffMenuCheckboxItem
            key={option}
            checked={value === option}
            onCheckedChange={(checked) => onChange(checked ? option : null)}
          >
            {labelOf(option)}
          </StaffMenuCheckboxItem>
        ))}
      </StaffMenuContent>
    </StaffMenu>
  );
}
