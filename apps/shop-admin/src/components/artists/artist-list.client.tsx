"use client";

import {
  ArtistArchiveDialog,
  type ArtistArchiveTarget,
} from "@/components/artists/artist-archive-dialog.client";
import { ArtistCreateDialog } from "@/components/artists/artist-create-dialog.client";
import { useWorkList } from "@/components/use-work-list.client";
import {
  type ArtistListState,
  artistArtworksHref,
  artistHref,
  artistList,
} from "@/server/domain/artist-list.vm";
import { presentStatus } from "@/server/domain/staff-status";
import type { AdminArtistList, AdminArtistListItem } from "@auction/shop-contracts";
import {
  type DataColumn,
  ListPage,
  MappedStatusBadge,
  type OverflowAction,
  PrimaryCell,
  StaffButton,
  StaffDate,
} from "@auction/staff-ui";
import { Archive, ArchiveRestore, ExternalLink, Images, Plus } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

const presentArtistStatus = presentStatus("artist");

const statusOf = (row: AdminArtistListItem) => (row.archived ? "archived" : "active");

/**
 * Artists on lax.art and LAX Shop on the staff list template: active by default, archived and all
 * a view away with counts, search by name or web address, A to Z on the server. A row opens the
 * artist's page, which holds their sign-in, search listing, works, editions and sales.
 */
export function ArtistList({
  state,
  page,
  canWrite,
  loadFailed = false,
}: {
  state: ArtistListState;
  page: AdminArtistList;
  canWrite: boolean;
  loadFailed?: boolean;
}) {
  const router = useRouter();
  const list = useWorkList({
    list: artistList,
    state,
    page,
    noun: { one: "artist", other: "artists" },
    search: { label: "Search artists", placeholder: "Search by name or web address" },
  });
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState<ArtistArchiveTarget | null>(null);
  const rowHref = useCallback(
    (row: AdminArtistListItem) => artistList.recordHref(state, artistHref(row.artistId)),
    [state],
  );

  const columns = useMemo<DataColumn<AdminArtistListItem>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        sortable: true,
        defaultSortDirection: "asc",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell href={rowHref(row)} Link={Link} secondary={`/${row.slug}`}>
            {row.displayName}
          </PrimaryCell>
        ),
      },
      {
        id: "discipline",
        header: "Discipline",
        width: "22%",
        mobile: "meta",
        cell: (row) => row.discipline ?? "",
      },
      {
        id: "artworks",
        header: "Artworks",
        width: "112px",
        numeric: true,
        mobile: "meta",
        cell: (row) => row.artworkCount ?? 0,
      },
      {
        id: "status",
        header: "Status",
        width: "120px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <MappedStatusBadge status={statusOf(row)} present={presentArtistStatus} />,
      },
      {
        id: "created",
        header: "Added",
        width: "184px",
        sortable: true,
        defaultSortDirection: "desc",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StaffDate value={row.createdAt} withTime />,
      },
    ],
    [rowHref],
  );

  const rowActions = (row: AdminArtistListItem): OverflowAction[] => [
    {
      id: "page",
      label: "Open artist page",
      icon: ExternalLink,
      href: rowHref(row),
    },
    ...((row.artworkCount ?? 0) > 0
      ? [
          {
            id: "artworks",
            label: "Show their artworks",
            icon: Images,
            onSelect: () => router.push(artistArtworksHref(row.artistId)),
          },
        ]
      : []),
    ...(canWrite
      ? [
          row.archived
            ? {
                id: "restore",
                label: "Restore artist…",
                icon: ArchiveRestore,
                onSelect: () => setArchiving(archiveTarget(row)),
              }
            : {
                id: "archive",
                label: "Archive artist…",
                icon: Archive,
                tone: "danger" as const,
                onSelect: () => setArchiving(archiveTarget(row)),
              },
        ]
      : []),
  ];

  const newArtist = canWrite ? (
    <StaffButton variant="primary" icon={<Plus aria-hidden />} onClick={() => setCreating(true)}>
      New artist
    </StaffButton>
  ) : undefined;

  return (
    <>
      <ListPage<AdminArtistListItem>
        title="Artists"
        access={canWrite ? "full" : "read-only"}
        description="Artists on lax.art and LAX Shop. Open one to link their sign-in, edit their search listing, see their works or archive them."
        primaryAction={newArtist}
        Link={list.Link}
        listKey="lax-admin.artists"
        views={list.views}
        search={list.search}
        activeFilters={list.searchChip}
        onClearFilters={list.clearFilters}
        loading={list.pending}
        filtered={list.filtered}
        error={
          loadFailed
            ? {
                title: "Artists did not load",
                description: "Something went wrong on our side. Try again in a moment.",
                onRetry: () => list.navigate(artistList.href(state)),
              }
            : null
        }
        empty={
          state.view === "archived"
            ? {
                illustration: "easel",
                title: "No archived artists",
                description: "Artists you archive move here. Their sales history stays on record.",
              }
            : {
                illustration: "easel",
                title: "No artists yet",
                description: "Add an artist, then give them their first artwork.",
                action: newArtist,
              }
        }
        noResults={{ noun: "artists" }}
        table={{
          columns,
          data: page.items,
          getRowId: (row) => row.artistId,
          ...list.sort,
          rowHref,
          rowActions: {
            label: (row) => `Actions for ${row.displayName}`,
            actions: rowActions,
          },
        }}
        pageSize={list.pageSize}
        pagination={list.pagination}
      />

      {canWrite ? <ArtistCreateDialog open={creating} onOpenChange={setCreating} /> : null}
      <ArtistArchiveDialog target={archiving} onClose={() => setArchiving(null)} />
    </>
  );
}

function archiveTarget(row: AdminArtistListItem): ArtistArchiveTarget {
  return { artistId: row.artistId, displayName: row.displayName, archived: row.archived ?? false };
}
