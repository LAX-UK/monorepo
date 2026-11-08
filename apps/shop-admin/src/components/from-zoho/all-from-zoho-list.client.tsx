"use client";

import { artworkCell } from "@/components/from-zoho/from-zoho-list.client";
import {
  FROM_ZOHO_DESCRIPTION,
  FROM_ZOHO_TITLE,
  useQueueFrame,
} from "@/components/from-zoho/use-queue-frame.client";
import { useRegisterRowActions } from "@/components/from-zoho/use-register-row-actions.client";
import {
  type ZohoQueueQuery,
  hasActiveZohoFilters,
  kindLabel,
  pageLinks,
  pageSummary,
  zohoQueueHref,
} from "@/server/domain/zoho-register.vm";
import type { AdminRegisterAllItem, AdminRegisterAllList } from "@auction/shop-contracts";
import {
  type DataColumn,
  FilterSheet,
  ListPage,
  StaffDate,
  WhereItIsChip,
} from "@auction/staff-ui";
import { useMemo } from "react";

const COLUMNS: DataColumn<AdminRegisterAllItem>[] = [
  { id: "artwork", header: "Artwork", mobile: "title", cell: artworkCell },
  {
    id: "where",
    header: "Where it is",
    width: "200px",
    mobile: "badge",
    truncate: false,
    cell: (row) => <WhereItIsChip chip={row.whereItIs.chip} />,
  },
  {
    id: "kind",
    header: "Type",
    width: "110px",
    hideBelow: "md",
    cell: (row) => kindLabel(row.kind),
  },
  {
    id: "edited",
    header: "Zoho last edited",
    width: "150px",
    mobile: "meta",
    truncate: false,
    cell: (row) => <StaffDate value={row.zohoModifiedAt} />,
  },
];

/**
 * Every artwork Zoho has sent, wherever it is now, so staff can find one after it leaves "New from
 * Zoho". Each row says where the artwork is; the filters narrow by artist and by that place. An
 * artwork that is not offered anywhere can still be offered from its row's "…" menu.
 */
export function AllFromZohoList({
  query,
  page,
  zohoUrlTemplate = null,
  unlinked = 0,
  bidAdminUrl = null,
}: {
  query: ZohoQueueQuery;
  page: AdminRegisterAllList;
  zohoUrlTemplate?: string | null;
  unlinked?: number;
  bidAdminUrl?: string | null;
}) {
  const { pending, navigate, ListLink, views } = useQueueFrame(query, page.counts, unlinked);
  const { actionsFor, dialogs } = useRegisterRowActions({ navigate, zohoUrlTemplate, bidAdminUrl });
  const links = pageLinks(query, page);
  const artistName = page.artists.find((artist) => artist.code === query.artist)?.name;
  const placeLabel = page.places.find((place) => place.value === query.place)?.label;

  const activeFilters = useMemo(
    () => [
      ...(query.artist
        ? [
            {
              id: "artist",
              label: `Artist: ${artistName ?? query.artist}`,
              onRemove: () => navigate(zohoQueueHref(query, { artist: null })),
            },
          ]
        : []),
      ...(query.place
        ? [
            {
              id: "place",
              label: `Where it is: ${placeLabel ?? query.place}`,
              onRemove: () => navigate(zohoQueueHref(query, { place: null })),
            },
          ]
        : []),
    ],
    [query, artistName, placeLabel, navigate],
  );

  return (
    <>
      <ListPage<AdminRegisterAllItem>
        title={FROM_ZOHO_TITLE}
        description={FROM_ZOHO_DESCRIPTION}
        Link={ListLink}
        listKey="from-zoho-all"
        views={views}
        filters={
          <FilterSheet
            title="Filter artworks"
            sections={[
              {
                kind: "radio",
                id: "place",
                label: "Where it is",
                anyLabel: "Anywhere",
                options: page.places.map((place) => ({
                  value: place.value,
                  label: `${place.label} (${place.count})`,
                })),
                value: query.place ?? "",
              },
              {
                kind: "radio",
                id: "artist",
                label: "Artist",
                anyLabel: "Any artist",
                options: page.artists.map((artist) => ({
                  value: artist.code,
                  label: `${artist.name} (${artist.count})`,
                })),
                value: query.artist ?? "",
              },
            ]}
            onApply={(values) =>
              navigate(
                zohoQueueHref(query, {
                  artist: (values.artist as string) || null,
                  place: (values.place as ZohoQueueQuery["place"] | "") || null,
                }),
              )
            }
          />
        }
        activeFilters={activeFilters}
        onClearFilters={() => navigate(zohoQueueHref({ tab: "all" }))}
        loading={pending}
        filtered={hasActiveZohoFilters(query)}
        empty={{
          illustration: "plinth",
          title: "No artworks from Zoho yet",
          description: "Artworks that Zoho sends to LAX appear here, wherever they are offered.",
        }}
        noResults={{ noun: "artworks" }}
        table={{
          columns: COLUMNS,
          data: page.items,
          getRowId: (row) => row.registerId,
          defaultDensity: "comfortable",
          onRowOpen: (row) => navigate(`/from-zoho/${row.registerId}`),
          rowActions: {
            label: (row) => `Actions for ${row.title}`,
            actions: (row) => actionsFor(row, row.whereItIs.key === "not_offered"),
          },
        }}
        pagination={
          page.items.length > 0
            ? { summary: pageSummary(page), prevLabel: "Previous page", ...links }
            : null
        }
      />
      {dialogs}
    </>
  );
}
