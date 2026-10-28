"use client";

import { ArtistQuickView } from "@/components/admin/artists/artist-quick-view";
import { useArtistActions } from "@/components/admin/artists/use-artist-actions";
import { useListPanel } from "@/components/admin/staff/use-list-panel";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  ARTISTS_DEFAULT_SORT,
  ARTIST_FLAG_FILTERS,
  ARTIST_KIND_FILTERS,
  ARTIST_LINKED_FILTERS,
  ARTIST_STATUS_FILTERS,
  type ArtistsListSearch,
  type ArtistsStaffRow,
  artistPanelHref,
  artistsListHref,
  artistsQueueHref,
  artistsSortHref,
  artistsSortState,
} from "@/lib/admin/artists/artists-staff-list.vm";
import {
  type AttentionStripItem,
  type DataColumn,
  DataViews,
  type EntityOption,
  FilterSheet,
  ListPage,
  type Metric,
  PrimaryCell,
  StaffButton,
  type DataView as StaffDataView,
  StaffDate,
  StatusBadge,
  TableSearch,
} from "@auction/staff-ui";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo } from "react";

export type ArtistsStaffListProps = {
  rows: ArtistsStaffRow[];
  search: ArtistsListSearch;
  views: StaffDataView[];
  activeLens: string;
  attention: AttentionStripItem[];
  metrics: Metric[] | null;
  filterChips: Array<{ id: string; label: string; clearHref: string }>;
  categoryOptions: EntityOption[];
  countryOptions: EntityOption[];
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  permissions: { canWrite: boolean; canReview: boolean; canMerge: boolean };
  listError: string | null;
  filtered: boolean;
};

const count = new Intl.NumberFormat("en-GB");

function text(search: ArtistsListSearch, key: string): string {
  const value = search[key];
  return typeof value === "string" ? value : "";
}

/**
 * Bid's artist registry on the staff list template: lenses as views with counts, search, a filter
 * sheet for status, kind, owner account, category, country and flags, server sorting, the review
 * queues in the attention strip, and a record panel deep-linked with `?artist=`. Pending profiles
 * are approved or rejected from the row's `…` menu, each confirmed first.
 */
export function ArtistsStaffList(props: ArtistsStaffListProps) {
  const { rows, search, permissions } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const panelHref = useCallback((id: string | null) => artistPanelHref(search, id), [search]);
  const panel = useListPanel({
    param: "artist",
    initialId: text(search, "artist") || null,
    hrefFor: panelHref,
  });
  const artistActions = useArtistActions({ canReview: permissions.canReview });
  const q = text(search, "q");
  const flags = ARTIST_FLAG_FILTERS.map((flag) => flag.value).filter(
    (key) => text(search, key) === "true" || text(search, key) === "1",
  );

  const columns = useMemo<DataColumn<ArtistsStaffRow>[]>(
    () => [
      {
        id: "artist",
        header: "Artist",
        mobile: "title",
        sortable: true,
        defaultSortDirection: "asc",
        cell: (row) => (
          <PrimaryCell
            href={panelHref(row.id)}
            Link={panel.PanelLink}
            thumbnail={{ src: row.portraitUrl, missingLabel: "No portrait yet" }}
            secondary={row.context}
          >
            {row.name}
          </PrimaryCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "148px",
        mobile: "badge",
        truncate: false,
        cell: (row) =>
          row.status ? <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge> : null,
      },
      {
        id: "owner",
        header: "Owner account",
        width: "20%",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => row.owner,
      },
      {
        id: "lots",
        header: "Lots",
        width: "88px",
        numeric: true,
        sortable: true,
        defaultSortDirection: "desc",
        mobile: "meta",
        cell: (row) => count.format(row.lots),
      },
      {
        id: "updated",
        header: "Updated",
        width: "120px",
        sortable: true,
        defaultSortDirection: "desc",
        hideBelow: "md",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StaffDate value={row.updatedAt} />,
      },
    ],
    [panelHref, panel.PanelLink],
  );

  const activeFilters = props.filterChips.map((chip) => ({
    id: chip.id,
    label: chip.label,
    onRemove: () => navigate(chip.clearHref),
  }));
  const clearHref = artistsListHref(search, {
    q: null,
    status: null,
    kind: null,
    linked: null,
    categoryId: null,
    country: null,
    featured: null,
    verified: null,
    includeArchived: null,
  });
  const openRow = rows.find((row) => row.id === panel.openId) ?? null;
  const rowActions = (row: ArtistsStaffRow) => [
    ...(permissions.canMerge
      ? [{ id: "duplicates", label: "Review possible duplicates", href: row.duplicatesHref }]
      : []),
    ...(row.publicHref
      ? [
          {
            id: "site",
            label: "View on site",
            onSelect: () => window.open(row.publicHref ?? "", "_blank", "noopener,noreferrer"),
          },
        ]
      : []),
    ...artistActions.actionsFor(row),
  ];

  return (
    <>
      <ListPage<ArtistsStaffRow>
        title="Artists"
        description="Canonical artist profiles, their owner accounts and the attribution lots point to."
        Link={ListLink}
        listKey="bid-admin.artists"
        access={permissions.canWrite || permissions.canReview ? "full" : "read-only"}
        primaryAction={
          permissions.canWrite ? (
            <StaffButton asChild variant="primary" size="sm" icon={<Plus aria-hidden />}>
              <Link href="/admin/artists/new">New artist</Link>
            </StaffButton>
          ) : null
        }
        secondaryActions={
          permissions.canMerge ? (
            <StaffButton asChild variant="secondary" size="sm">
              <Link href={artistsQueueHref("duplicates")}>Review duplicates</Link>
            </StaffButton>
          ) : null
        }
        attention={props.attention}
        {...(props.metrics
          ? { metrics: { label: "Artists summary", period: "All artists", items: props.metrics } }
          : {})}
        views={<DataViews views={props.views} activeId={props.activeLens} Link={ListLink} />}
        search={
          <TableSearch
            key={q}
            fullWidth
            label="Search artists"
            placeholder="Search by name or alias"
            value={q}
            onSearch={(next) => navigate(artistsListHref(search, { q: next || null }))}
          />
        }
        filters={
          <FilterSheet
            title="Filter artists"
            sections={[
              {
                kind: "radio",
                id: "status",
                label: "Review status",
                anyLabel: "Any status",
                options: ARTIST_STATUS_FILTERS,
                value: text(search, "status"),
              },
              {
                kind: "radio",
                id: "kind",
                label: "Kind",
                anyLabel: "Any kind",
                options: ARTIST_KIND_FILTERS,
                value: text(search, "kind"),
              },
              {
                kind: "radio",
                id: "linked",
                label: "Owner account",
                anyLabel: "Either",
                options: ARTIST_LINKED_FILTERS,
                value: text(search, "linked"),
              },
              {
                kind: "entity",
                id: "categoryId",
                label: "Category",
                value: text(search, "categoryId"),
                options: props.categoryOptions,
                placeholder: "Any category",
                searchPlaceholder: "Search categories",
                emptyText: "No categories match.",
              },
              {
                kind: "entity",
                id: "country",
                label: "Country",
                value: text(search, "country").toUpperCase(),
                options: props.countryOptions,
                placeholder: "Any country",
                searchPlaceholder: "Search countries",
                emptyText: "No countries match.",
              },
              {
                kind: "checklist",
                id: "flags",
                label: "Flags",
                options: ARTIST_FLAG_FILTERS,
                value: flags,
              },
            ]}
            onApply={(values) => {
              const chosen = new Set((values.flags as readonly string[]) ?? []);
              navigate(
                artistsListHref(search, {
                  status: (values.status as string) || null,
                  kind: (values.kind as string) || null,
                  linked: (values.linked as string) || null,
                  categoryId: (values.categoryId as string) || null,
                  country: (values.country as string) || null,
                  featured: chosen.has("featured") ? "true" : null,
                  verified: chosen.has("verified") ? "true" : null,
                  includeArchived: chosen.has("includeArchived") ? "true" : null,
                }),
              );
            }}
          />
        }
        activeFilters={activeFilters}
        onClearFilters={() => navigate(clearHref)}
        loading={pending}
        filtered={props.filtered}
        error={
          props.listError
            ? { description: props.listError, onRetry: () => navigate(artistsListHref(search, {})) }
            : null
        }
        empty={{
          title: "No artists yet",
          description: "Create canonical profiles before attributing lots to artists.",
          ...(permissions.canWrite
            ? {
                action: (
                  <StaffButton asChild size="sm" variant="primary">
                    <Link href="/admin/artists/new">New artist</Link>
                  </StaffButton>
                ),
              }
            : {}),
        }}
        noResults={{ noun: "artists" }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.id,
          defaultDensity: "comfortable",
          defaultSort: ARTISTS_DEFAULT_SORT,
          sort: artistsSortState(text(search, "sort") || undefined),
          onSortChange: (sort) => navigate(artistsSortHref(search, sort)),
          onRowOpen: (row) => panel.show(row.id),
          activeRowId: panel.openId,
          rowActions: {
            label: (row) => `Actions for artist ${row.name}`,
            actions: (row) => [
              { id: "open", label: "Open details", onSelect: () => panel.show(row.id) },
              { id: "page", label: "Open artist page", href: row.href },
              ...(permissions.canWrite
                ? [{ id: "edit", label: "Edit artist", href: row.editHref }]
                : []),
              ...rowActions(row),
            ],
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(artistsListHref(search, { limit: size })),
        }}
        pagination={props.pagination}
      />
      <ArtistQuickView
        row={openRow}
        canWrite={permissions.canWrite}
        onClose={() => panel.show(null)}
        actions={openRow ? rowActions(openRow) : []}
      />
      {artistActions.dialogs}
    </>
  );
}
