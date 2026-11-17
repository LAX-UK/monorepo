"use client";

import { artworkCell } from "@/components/from-zoho/from-zoho-list.client";
import {
  FROM_ZOHO_DESCRIPTION,
  FROM_ZOHO_TITLE,
  useQueueFrame,
} from "@/components/from-zoho/use-queue-frame.client";
import { useRegisterRowActions } from "@/components/from-zoho/use-register-row-actions.client";
import { ZohoPriceValue } from "@/components/from-zoho/zoho-price-value";
import { MoveArtworksDialog } from "@/components/stock-location/move-artworks-dialog.client";
import {
  CONSIGNOR_NOT_SET,
  consignorFilterChip,
  consignorFilterOptions,
  consignorName,
} from "@/server/domain/artwork-consignor.vm";
import { LOCATION_NOT_RECORDED, locationFilterOptions } from "@/server/domain/stock-location.vm";
import {
  type ZohoQueueQuery,
  hasActiveZohoFilters,
  kindLabel,
  pageLinks,
  pageSummary,
  zohoAllSortHref,
  zohoAllSortState,
  zohoQueueHref,
} from "@/server/domain/zoho-register.vm";
import type {
  AdminRegisterAllItem,
  AdminRegisterAllList,
  AdminStockLocation,
} from "@auction/shop-contracts";
import {
  type DataColumn,
  FilterSheet,
  ListPage,
  StaffButton,
  StaffDate,
  WhereItIsChip,
  useStaffCan,
} from "@auction/staff-ui";
import { MapPin } from "@auction/staff-ui/icons";
import { useMemo, useState } from "react";

/** Optional columns, off until staff turn them on in Display (TBL-12). */
const HIDDEN_BY_DEFAULT = ["zohoPrice", "consignor"];

/**
 * Who consigned the work. Only for people who can read consignor agreements: shop-api sends the
 * consignor with each row for them alone.
 */
const CONSIGNOR_COLUMN: DataColumn<AdminRegisterAllItem> = {
  id: "consignor",
  header: "Consignor",
  width: "190px",
  mobile: "hidden",
  cell: (row) =>
    row.consignor ? (
      consignorName(row.consignor)
    ) : (
      <span className="text-staff-muted">{CONSIGNOR_NOT_SET}</span>
    ),
};

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
    id: "location",
    header: "Location",
    width: "180px",
    mobile: "meta",
    // Says "Location" itself, since on a phone the column header is gone and this reads as meta.
    cell: (row) =>
      row.location?.label ?? <span className="text-staff-muted">{LOCATION_NOT_RECORDED}</span>,
  },
  {
    id: "kind",
    header: "Type",
    width: "110px",
    hideBelow: "md",
    cell: (row) => kindLabel(row.kind),
  },
  {
    // Information only, hidden by default (TBL-12). The server sorts it across every page, with
    // the unpriced works together at the end either way.
    id: "zohoPrice",
    header: "Price in Zoho",
    width: "140px",
    numeric: true,
    sortable: true,
    defaultSortDirection: "asc",
    mobile: "hidden",
    truncate: false,
    cell: (row) => <ZohoPriceValue zohoPrice={row.zohoPrice} />,
  },
  CONSIGNOR_COLUMN,
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
 * Zoho". Each row says where the artwork is offered and where it physically is; the filters
 * narrow by artist, by that place and by location. People who can read consignor agreements also
 * get an optional Consignor column (hidden by default) and a Consignor filter. An artwork that is not offered anywhere can
 * still be offered from its row's "…" menu. People who can move artworks select rows and use
 * "Move selected" to move a hang or a shipment in one go.
 */
export function AllFromZohoList({
  query,
  page,
  zohoUrlTemplate = null,
  unlinked = 0,
  bidAdminUrl = null,
  locations = null,
}: {
  query: ZohoQueueQuery;
  page: AdminRegisterAllList;
  zohoUrlTemplate?: string | null;
  unlinked?: number;
  bidAdminUrl?: string | null;
  /** Every location, for the Location filter and Move selected; null when it did not load. */
  locations?: readonly AdminStockLocation[] | null;
}) {
  const { pending, navigate, ListLink, views } = useQueueFrame(query, page.counts, unlinked);
  const { actionsFor, dialogs } = useRegisterRowActions({ navigate, zohoUrlTemplate, bidAdminUrl });
  const links = pageLinks(query, page);
  const artistName = page.artists.find((artist) => artist.code === query.artist)?.name;
  const placeLabel = page.places.find((place) => place.value === query.place)?.label;
  const locationOptions = locations ? locationFilterOptions(locations) : [];
  const locationLabel = locationOptions.find((option) => option.value === query.location)?.label;
  const canMove = useStaffCan("artwork_location.move") && locations !== null;
  // shop-api sends consignors only to people who can read consignor agreements.
  const consignors = page.consignors;
  const consignorOptions = consignors ? consignorFilterOptions(consignors) : [];
  const columns = useMemo(
    () => (consignors ? COLUMNS : COLUMNS.filter((column) => column.id !== CONSIGNOR_COLUMN.id)),
    [consignors],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [moving, setMoving] = useState<AdminRegisterAllItem[] | null>(null);

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
      ...(query.location
        ? [
            {
              id: "location",
              label: `Location: ${locationLabel ?? "Unknown"}`,
              onRemove: () => navigate(zohoQueueHref(query, { location: null })),
            },
          ]
        : []),
      ...(query.consignor
        ? [
            {
              id: "consignor",
              label: consignorFilterChip(query.consignor, consignors),
              onRemove: () => navigate(zohoQueueHref(query, { consignor: null })),
            },
          ]
        : []),
    ],
    [query, artistName, placeLabel, locationLabel, consignors, navigate],
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
              ...(locationOptions.length > 0
                ? [
                    {
                      kind: "radio" as const,
                      id: "location",
                      label: "Location",
                      anyLabel: "Any location",
                      options: locationOptions,
                      value: query.location ?? "",
                    },
                  ]
                : []),
              ...(consignorOptions.length > 0
                ? [
                    {
                      kind: "radio" as const,
                      id: "consignor",
                      label: "Consignor",
                      anyLabel: "Any consignor",
                      options: consignorOptions,
                      value: query.consignor ?? "",
                    },
                  ]
                : []),
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
                  location: (values.location as string) || null,
                  consignor: (values.consignor as string) || null,
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
          columns,
          data: page.items,
          getRowId: (row) => row.registerId,
          defaultDensity: "comfortable",
          defaultHiddenColumns: HIDDEN_BY_DEFAULT,
          // Sorted by the server across every page; the order is in the URL so Back keeps it.
          sort: zohoAllSortState(query),
          onSortChange: (next) => navigate(zohoAllSortHref(query, next)),
          onRowOpen: (row) => navigate(`/from-zoho/${row.registerId}`),
          rowActions: {
            label: (row) => `Actions for ${row.title}`,
            actions: (row) => actionsFor(row, row.whereItIs.key === "not_offered"),
          },
          ...(canMove
            ? {
                selectedIds: selected,
                onSelectedIdsChange: setSelected,
                bulkNoun: { one: "artwork", other: "artworks" },
                bulkActions: (picked: AdminRegisterAllItem[]) => (
                  <StaffButton
                    size="sm"
                    variant="primary"
                    icon={<MapPin aria-hidden />}
                    onClick={() => setMoving(picked)}
                  >
                    Move selected…
                  </StaffButton>
                ),
              }
            : {}),
        }}
        pagination={
          page.items.length > 0
            ? { summary: pageSummary(page), prevLabel: "Previous page", ...links }
            : null
        }
      />
      {dialogs}
      {moving && locations ? (
        <MoveArtworksDialog
          registerIds={moving.map((row) => row.registerId)}
          subject={
            moving.length === 1 ? (moving[0]?.title ?? "1 artwork") : `${moving.length} artworks`
          }
          locations={locations}
          onClose={() => setMoving(null)}
          onMoved={() => setSelected(new Set())}
        />
      ) : null}
    </>
  );
}
