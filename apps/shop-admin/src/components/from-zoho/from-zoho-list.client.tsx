"use client";

import {
  FROM_ZOHO_DESCRIPTION,
  FROM_ZOHO_TITLE,
  useQueueFrame,
} from "@/components/from-zoho/use-queue-frame.client";
import {
  CONFLICT_FIELD_LABEL,
  GAP_LABEL,
  GAP_OPTIONS,
  type ZohoQueueQuery,
  hasActiveZohoFilters,
  pageLinks,
  pageSummary,
  presentConflictValue,
  zohoQueueHref,
} from "@/server/domain/zoho-register.vm";
import type {
  AdminRegisterArtworkSummary,
  AdminRegisterConflictItem,
  AdminRegisterConflictList,
  AdminRegisterNewList,
} from "@auction/shop-contracts";
import {
  type DataColumn,
  FilterSheet,
  ListPage,
  PrimaryCell,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import Link from "next/link";
import { useMemo } from "react";

const recordHref = (registerId: string) => `/from-zoho/${registerId}`;

function artworkCell(row: AdminRegisterArtworkSummary) {
  return (
    <PrimaryCell
      href={recordHref(row.registerId)}
      Link={Link}
      secondary={`${row.artistName} · ${row.stockCode}`}
    >
      {row.title}
    </PrimaryCell>
  );
}

const MISSING_COLUMN: DataColumn<AdminRegisterArtworkSummary> = {
  id: "missing",
  header: "What is missing",
  width: "280px",
  mobile: "meta",
  truncate: false,
  cell: (row) =>
    row.missing.length === 0 ? (
      <StatusBadge tone="success">Nothing missing</StatusBadge>
    ) : (
      <span className="flex flex-wrap gap-1">
        {row.missing.map((gap) => (
          <StatusBadge key={gap} tone="warning">
            {GAP_LABEL[gap]}
          </StatusBadge>
        ))}
      </span>
    ),
};

/**
 * Artworks that came in from Zoho and are not offered anywhere yet, on the staff list template:
 * what each one still lacks, filters for artist and for one missing part, and a link to each
 * record. Catalogue details are changed in Zoho, so the rows carry no actions.
 */
export function NewFromZohoList({
  query,
  page,
}: {
  query: ZohoQueueQuery;
  page: AdminRegisterNewList;
}) {
  const { pending, navigate, ListLink, views } = useQueueFrame(query, page.counts);
  const filtered = hasActiveZohoFilters(query);
  const artistName = page.artists.find((artist) => artist.code === query.artist)?.name;

  const columns = useMemo<DataColumn<AdminRegisterArtworkSummary>[]>(
    () => [
      { id: "artwork", header: "Artwork", mobile: "title", cell: artworkCell },
      MISSING_COLUMN,
      {
        id: "edited",
        header: "Zoho last edited",
        width: "150px",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.zohoModifiedAt} />,
      },
    ],
    [],
  );

  const activeFilters = [
    ...(query.artist
      ? [
          {
            id: "artist",
            label: `Artist: ${artistName ?? query.artist}`,
            onRemove: () => navigate(zohoQueueHref(query, { artist: null })),
          },
        ]
      : []),
    ...(query.missing
      ? [
          {
            id: "missing",
            label: `Missing: ${GAP_LABEL[query.missing].toLowerCase()}`,
            onRemove: () => navigate(zohoQueueHref(query, { missing: null })),
          },
        ]
      : []),
  ];
  const links = pageLinks(query, page);

  return (
    <ListPage<AdminRegisterArtworkSummary>
      title={FROM_ZOHO_TITLE}
      description={FROM_ZOHO_DESCRIPTION}
      Link={ListLink}
      listKey="from-zoho-new"
      views={views}
      filters={
        <FilterSheet
          title="Filter new artworks"
          sections={[
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
            {
              kind: "radio",
              id: "missing",
              label: "Missing",
              anyLabel: "Anything",
              options: GAP_OPTIONS,
              value: query.missing ?? "",
            },
          ]}
          onApply={(values) =>
            navigate(
              zohoQueueHref(query, {
                artist: (values.artist as string) || null,
                missing: (values.missing as ZohoQueueQuery["missing"] | "") || null,
              }),
            )
          }
        />
      }
      activeFilters={activeFilters}
      onClearFilters={() => navigate(zohoQueueHref({}))}
      loading={pending}
      filtered={filtered}
      empty={{
        illustration: "plinth",
        title: "Nothing new from Zoho",
        description:
          "Artworks that come in from Zoho and are not offered anywhere yet appear here.",
      }}
      noResults={{ noun: "artworks" }}
      table={{
        columns,
        data: page.items,
        getRowId: (row) => row.registerId,
        defaultDensity: "comfortable",
        onRowOpen: (row) => navigate(recordHref(row.registerId)),
      }}
      pagination={
        page.items.length > 0
          ? { summary: pageSummary(page), prevLabel: "Previous page", ...links }
          : null
      }
    />
  );
}

/** Conflicts waiting for a decision: what differs and the value each side holds. */
export function NeedsDecisionList({
  query,
  page,
}: {
  query: ZohoQueueQuery;
  page: AdminRegisterConflictList;
}) {
  const { pending, navigate, ListLink, views } = useQueueFrame(query, page.counts);
  const links = pageLinks(query, page);

  const columns = useMemo<DataColumn<AdminRegisterConflictItem>[]>(
    () => [
      {
        id: "artwork",
        header: "Artwork",
        mobile: "title",
        cell: (row) => artworkCell(row.artwork),
      },
      {
        id: "differs",
        header: "What differs",
        width: "160px",
        mobile: "badge",
        truncate: false,
        cell: (row) => (
          <StatusBadge tone="warning">{CONFLICT_FIELD_LABEL[row.conflict.field]}</StatusBadge>
        ),
      },
      {
        id: "zoho",
        header: "In Zoho",
        width: "210px",
        mobile: "meta",
        cell: (row) => presentConflictValue(row.conflict.field, row.conflict.zohoValue) ?? "Empty",
      },
      {
        id: "lax",
        header: "In LAX",
        width: "210px",
        mobile: "meta",
        cell: (row) => presentConflictValue(row.conflict.field, row.conflict.laxValue) ?? "Empty",
      },
      {
        id: "edited",
        header: "Zoho last edited",
        width: "150px",
        hideBelow: "lg",
        truncate: false,
        cell: (row) => <StaffDate value={row.conflict.zohoModifiedAt} />,
      },
    ],
    [],
  );

  return (
    <ListPage<AdminRegisterConflictItem>
      title={FROM_ZOHO_TITLE}
      description={FROM_ZOHO_DESCRIPTION}
      Link={ListLink}
      listKey="from-zoho-decisions"
      views={views}
      loading={pending}
      filtered={false}
      empty={{
        illustration: "plinth",
        title: "Nothing needs a decision",
        description:
          "When Zoho and LAX disagree about an artwork, it appears here with both versions.",
      }}
      noResults={{ noun: "conflicts" }}
      table={{
        columns,
        data: page.items,
        getRowId: (row) => row.conflict.conflictId,
        defaultDensity: "comfortable",
        onRowOpen: (row) => navigate(recordHref(row.artwork.registerId)),
      }}
      pagination={
        page.items.length > 0
          ? { summary: pageSummary(page), prevLabel: "Previous page", ...links }
          : null
      }
    />
  );
}
