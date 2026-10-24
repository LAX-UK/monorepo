"use client";

import { ArtistCreateDialog } from "@/components/artists/artist-create-dialog.client";
import { useListNavigation } from "@/components/use-list-navigation.client";
import {
  ARTIST_LIST_PATH,
  ARTIST_VIEWS,
  ARTIST_VIEW_LABELS,
  type ArtistListQuery,
  artistListHref,
  artistListPageHref,
  artistListView,
  presentArtistStatus,
} from "@/server/domain/artist-list.vm";
import type { AdminArtistList, AdminArtistListItem } from "@auction/shop-contracts";
import {
  ActiveFilterChips,
  type DataColumn,
  DataTable,
  DataTableToolbar,
  DataViews,
  DensityToggle,
  EmptyState,
  MappedStatusBadge,
  NoResultsState,
  PageHeader,
  StaffButton,
  TablePagination,
  TableSearch,
  formatStaffDateTime,
  useTableDensity,
} from "@auction/staff-ui";
import { Plus } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

/**
 * Artists on lax.art and LAX Shop: active by default, archived a view away, searchable by name.
 * Staff who may change the catalogue add artists here; everything else is on the artist's page.
 */
export function ArtistList({
  query,
  page,
  canWrite,
}: {
  query: ArtistListQuery;
  page: AdminArtistList;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pending, navigate, Link: ListLink } = useListNavigation();
  const [density, setDensity] = useTableDensity("artists");
  const [creating, setCreating] = useState(false);
  const view = artistListView(query);

  const columns = useMemo<DataColumn<AdminArtistListItem>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        mobile: "title",
        sortable: true,
        sortValue: (row) => row.displayName.toLowerCase(),
        cell: (row) => (
          <Link
            href={`/artists/${row.artistId}`}
            className="staff-focus block truncate rounded-staff-xs font-medium text-staff-fg hover:underline"
          >
            {row.displayName}
          </Link>
        ),
      },
      {
        id: "slug",
        header: "Web address",
        hideBelow: "md",
        mobile: "hidden",
        cell: (row) => <span className="block truncate text-staff-muted">/{row.slug}</span>,
      },
      {
        id: "discipline",
        header: "Discipline",
        mobile: "meta",
        cell: (row) => row.discipline ?? <span className="text-staff-subtle">—</span>,
      },
      {
        id: "artworks",
        header: "Artworks",
        width: "104px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.artworkCount ?? 0,
        defaultSortDirection: "desc",
        mobile: "meta",
        cell: (row) =>
          row.artworkCount && row.artworkCount > 0 ? (
            <Link
              href={`/artworks?artist=${row.artistId}`}
              className="staff-focus rounded-staff-xs tabular-nums hover:underline"
              aria-label={`${row.artworkCount} artworks by ${row.displayName}`}
            >
              {row.artworkCount}
            </Link>
          ) : (
            <span className="text-staff-subtle tabular-nums">0</span>
          ),
      },
      {
        id: "status",
        header: "Status",
        width: "112px",
        mobile: "badge",
        cell: (row) => (
          <MappedStatusBadge
            status={row.archived ? "archived" : "active"}
            present={presentArtistStatus}
          />
        ),
      },
      {
        id: "created",
        header: "Added",
        width: "168px",
        numeric: true,
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => (
          <time dateTime={row.createdAt} className="text-staff-muted">
            {formatStaffDateTime(row.createdAt)}
          </time>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Artists"
        description="Artists on lax.art and LAX Shop. Open one to link their sign-in, edit their search listing, see their works or archive them."
        primaryAction={
          canWrite ? (
            <StaffButton
              variant="primary"
              icon={<Plus aria-hidden />}
              onClick={() => setCreating(true)}
            >
              New artist
            </StaffButton>
          ) : undefined
        }
      />
      <DataTable
        label="Artists"
        columns={columns}
        data={page.items}
        getRowId={(row) => row.artistId}
        defaultSort={{ columnId: "name", direction: "asc" }}
        density={density}
        loading={pending}
        onRowOpen={(row) => router.push(`/artists/${row.artistId}`)}
        toolbar={
          <DataTableToolbar
            views={
              <DataViews
                views={ARTIST_VIEWS.map((id) => ({
                  id,
                  label: ARTIST_VIEW_LABELS[id],
                  href: artistListHref(query, { view: id }),
                }))}
                activeId={view}
                Link={ListLink}
              />
            }
            search={
              <TableSearch
                key={query.q ?? ""}
                label="Search artists"
                placeholder="Name or web address"
                value={query.q ?? ""}
                onSearch={(q) => navigate(artistListHref(query, { q: q || null }))}
              />
            }
            activeFilters={
              <ActiveFilterChips
                filters={
                  query.q
                    ? [
                        {
                          id: "q",
                          label: `“${query.q}”`,
                          onRemove: () => navigate(artistListHref(query, { q: null })),
                        },
                      ]
                    : []
                }
              />
            }
            end={<DensityToggle value={density} onChange={setDensity} />}
          />
        }
        empty={
          query.q ? (
            <NoResultsState
              title="No artists match this search"
              description="Check the spelling, or search by part of the name."
              action={
                <StaffButton size="sm" onClick={() => navigate(ARTIST_LIST_PATH)}>
                  Clear search
                </StaffButton>
              }
            />
          ) : view === "archived" ? (
            <EmptyState
              title="No archived artists"
              description="Artists you archive move here. Their sales history stays on record."
            />
          ) : (
            <EmptyState
              title="No artists yet"
              description="Add an artist, then give them their first artwork."
              action={
                canWrite ? (
                  <StaffButton
                    size="sm"
                    variant="primary"
                    icon={<Plus aria-hidden />}
                    onClick={() => setCreating(true)}
                  >
                    New artist
                  </StaffButton>
                ) : undefined
              }
            />
          )
        }
        footer={
          page.items.length > 0 ? (
            <TablePagination
              summary={`${page.items.length} ${page.items.length === 1 ? "artist" : "artists"} on this page`}
              prevHref={query.cursor ? artistListHref(query) : null}
              prevLabel="First page"
              nextHref={page.nextCursor ? artistListPageHref(query, page.nextCursor) : null}
              Link={ListLink}
            />
          ) : null
        }
      />
      {canWrite ? <ArtistCreateDialog open={creating} onOpenChange={setCreating} /> : null}
    </div>
  );
}
