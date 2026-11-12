"use client";

import { FROM_ZOHO_TITLE, useQueueFrame } from "@/components/from-zoho/use-queue-frame.client";
import {
  type ZohoQueueQuery,
  pageLinks,
  pageSummary,
  skippedReasonLabel,
} from "@/server/domain/zoho-register.vm";
import {
  DRIFT_LISTS,
  NO_ZOHO_STATUS,
  leftOutReason,
  syncHealthHref,
} from "@/server/domain/zoho-sync-health.vm";
import type {
  AdminZohoProductWithoutRegisterList,
  AdminZohoRegisterWithoutProductList,
  AdminZohoStatusMismatchList,
  ZohoDriftList,
} from "@auction/shop-contracts";
import { type DataColumn, ListPage, PrimaryCell, StaffDate, TextLink } from "@auction/staff-ui";
import Link from "next/link";

type PagedList<Row> = { items: Row[]; total: number; page: number; pageSize: number };

const recordHref = (registerId: string) => `/from-zoho/${registerId}`;

type RegisterRow = AdminZohoRegisterWithoutProductList["items"][number];
type ProductRow = AdminZohoProductWithoutRegisterList["items"][number];
type MismatchRow = AdminZohoStatusMismatchList["items"][number];

function artworkCell(row: {
  registerId: string;
  title: string;
  artistName: string;
  stockCode: string;
}) {
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

const REGISTER_COLUMNS: DataColumn<RegisterRow>[] = [
  { id: "artwork", header: "Artwork", mobile: "title", cell: artworkCell },
  {
    id: "place",
    header: "Where it is in LAX",
    width: "200px",
    mobile: "badge",
    cell: (row) => row.place,
  },
  {
    id: "found",
    header: "Found missing",
    width: "160px",
    mobile: "meta",
    truncate: false,
    cell: (row) => <StaffDate value={row.foundAt} />,
  },
];

const PRODUCT_COLUMNS: DataColumn<ProductRow>[] = [
  {
    id: "product",
    header: "Zoho Product",
    mobile: "title",
    cell: (row) => (
      <PrimaryCell secondary={row.stockCode ?? "No stock code"}>
        {row.title ?? "Untitled Product"}
      </PrimaryCell>
    ),
  },
  {
    id: "reason",
    header: "Why it is not in LAX",
    width: "320px",
    mobile: "meta",
    truncate: false,
    cell: (row) => leftOutReason(row.reason, skippedReasonLabel),
  },
  {
    id: "found",
    header: "Last checked",
    width: "160px",
    hideBelow: "md",
    truncate: false,
    cell: (row) => <StaffDate value={row.foundAt} />,
  },
];

const MISMATCH_COLUMNS: DataColumn<MismatchRow>[] = [
  { id: "artwork", header: "Artwork", mobile: "title", cell: artworkCell },
  {
    id: "place",
    header: "Where it is in LAX",
    width: "190px",
    mobile: "badge",
    cell: (row) => row.place,
  },
  {
    id: "expected",
    header: "LAX writes",
    width: "130px",
    hideBelow: "md",
    cell: (row) => row.expectedStatus,
  },
  {
    id: "zoho",
    header: "Zoho shows",
    width: "150px",
    mobile: "meta",
    cell: (row) => (
      <>
        <span className="md:hidden">Zoho shows </span>
        {row.zohoStatus ?? NO_ZOHO_STATUS}
        <span className="md:hidden">, LAX writes {row.expectedStatus}</span>
      </>
    ),
  },
];

/** One drift list in the Sync health tab: read-only rows, each artwork linking to its record. */
function DriftList<Row>({
  list,
  query,
  counts,
  page,
  columns,
  getRowId,
  unlinked,
  openRow,
}: {
  list: ZohoDriftList;
  query: ZohoQueueQuery;
  counts: { new: number; decisions: number };
  page: PagedList<Row>;
  columns: DataColumn<Row>[];
  getRowId: (row: Row) => string;
  unlinked: number;
  openRow?: (row: Row) => string;
}) {
  const { pending, ListLink, views, navigate } = useQueueFrame(query, counts, unlinked);
  const spec = DRIFT_LISTS[list];
  const links = pageLinks(query, page);
  return (
    <ListPage<Row>
      title={FROM_ZOHO_TITLE}
      description={
        <>
          <strong className="font-semibold">{spec.title}.</strong> {spec.description}{" "}
          <TextLink href={syncHealthHref({})} Link={Link}>
            Back to Sync health
          </TextLink>
        </>
      }
      Link={ListLink}
      listKey={`from-zoho-health-${list}`}
      views={views}
      loading={pending}
      filtered={false}
      empty={{ illustration: "plinth", ...spec.empty }}
      noResults={{ noun: "artworks" }}
      table={{
        columns,
        data: page.items,
        getRowId,
        defaultDensity: "comfortable",
        ...(openRow ? { onRowOpen: (row: Row) => navigate(openRow(row)) } : {}),
      }}
      pagination={
        page.items.length > 0
          ? {
              summary: pageSummary(page),
              prevLabel: "Previous page",
              ...links,
            }
          : null
      }
    />
  );
}

type FrameProps = {
  query: ZohoQueueQuery;
  counts: { new: number; decisions: number };
  unlinked?: number;
};

export function RegisterWithoutProductList({
  query,
  counts,
  page,
  unlinked = 0,
}: FrameProps & { page: AdminZohoRegisterWithoutProductList }) {
  return (
    <DriftList
      list="register_without_product"
      query={query}
      counts={counts}
      page={page}
      columns={REGISTER_COLUMNS}
      getRowId={(row) => row.registerId}
      unlinked={unlinked}
      openRow={(row) => recordHref(row.registerId)}
    />
  );
}

export function ProductWithoutRegisterList({
  query,
  counts,
  page,
  unlinked = 0,
}: FrameProps & { page: AdminZohoProductWithoutRegisterList }) {
  return (
    <DriftList
      list="product_without_register"
      query={query}
      counts={counts}
      page={page}
      columns={PRODUCT_COLUMNS}
      getRowId={(row) => row.zohoProductId}
      unlinked={unlinked}
    />
  );
}

export function StatusMismatchList({
  query,
  counts,
  page,
  unlinked = 0,
}: FrameProps & { page: AdminZohoStatusMismatchList }) {
  return (
    <DriftList
      list="status_mismatch"
      query={query}
      counts={counts}
      page={page}
      columns={MISMATCH_COLUMNS}
      getRowId={(row) => row.registerId}
      unlinked={unlinked}
      openRow={(row) => recordHref(row.registerId)}
    />
  );
}
