"use client";

import { AdminStaffDataTable } from "@/components/admin-staff-data-table";
import { EnquiryStatusBadge } from "@/components/enquiries/enquiry-status-badge";
import { formatAdminDetailDateTime } from "@/lib/admin-detail-format";
import {
  ENQUIRY_TOPIC_LABELS,
  enquirySenderName,
  enquirySenderSecondary,
  enquiryStaffName,
} from "@/server/domain/enquiry-inbox.vm";
import type { AdminEnquiryListItem } from "@auction/shop-contracts";
import { EntityTableShell } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";

const detailHref = (row: AdminEnquiryListItem) => `/enquiries/${row.kind}/${row.id}`;
const rowKey = (row: AdminEnquiryListItem) => `${row.kind}:${row.id}`;

function Thumbnail({ row }: { row: AdminEnquiryListItem }) {
  if (!row.artwork?.thumbnailUrl) {
    return (
      <span
        aria-hidden
        className="size-10 shrink-0 rounded-md border border-border-hairline bg-surface-container-low"
      />
    );
  }
  return (
    // A plain img: thumbnails come from the media CDN, which next/image is not configured for.
    <img
      src={row.artwork.thumbnailUrl}
      alt=""
      loading="lazy"
      className="size-10 shrink-0 rounded-md border border-border-hairline object-cover"
    />
  );
}

function SenderCell({ row }: { row: AdminEnquiryListItem }) {
  const secondary = enquirySenderSecondary(row.sender);
  return (
    <div className="min-w-0">
      <Link
        href={detailHref(row)}
        className="font-medium text-on-surface underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {enquirySenderName(row.sender)}
      </Link>
      <p className="truncate text-xs text-on-surface-variant">
        {row.sender.type === "member" ? "Member" : "Guest"}
        {secondary ? ` · ${secondary}` : ""}
      </p>
    </div>
  );
}

function AboutCell({ row }: { row: AdminEnquiryListItem }) {
  if (!row.artwork) return <span>{ENQUIRY_TOPIC_LABELS[row.topic]}</span>;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Thumbnail row={row} />
      <span className="line-clamp-2">{row.artwork.title}</span>
    </div>
  );
}

const assigneeText = (row: AdminEnquiryListItem) =>
  row.assignee ? enquiryStaffName(row.assignee) : "Unassigned";

function EnquiryCard({ row }: { row: AdminEnquiryListItem }) {
  return (
    <li className="rounded-lg border border-border-hairline bg-surface-container-lowest p-4">
      <div className="flex items-start justify-between gap-3">
        <SenderCell row={row} />
        <EnquiryStatusBadge status={row.status} />
      </div>
      <div className="mt-3 text-sm text-on-surface">
        <AboutCell row={row} />
      </div>
      {row.excerpt ? (
        <p className="mt-2 line-clamp-3 text-sm text-on-surface-variant">{row.excerpt}</p>
      ) : null}
      <p className="mt-3 text-xs text-on-surface-variant">
        {assigneeText(row)} · {formatAdminDetailDateTime(row.createdAt)}
      </p>
    </li>
  );
}

/**
 * The inbox rows as a table from `lg` upwards and as cards below it, where a six-column table
 * would scroll sideways. Both link to the same detail page. The caller handles the empty case.
 */
export function EnquiryListTable({ items }: { items: AdminEnquiryListItem[] }) {
  const columns = useMemo<ColumnDef<AdminEnquiryListItem, unknown>[]>(
    () => [
      { id: "sender", header: "Sender", cell: ({ row }) => <SenderCell row={row.original} /> },
      { id: "about", header: "About", cell: ({ row }) => <AboutCell row={row.original} /> },
      {
        id: "message",
        header: "Message",
        cell: ({ row }) => (
          <p className="line-clamp-2 max-w-md text-on-surface-variant">{row.original.excerpt}</p>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <EnquiryStatusBadge status={row.original.status} />,
      },
      {
        id: "assignee",
        header: "Assignee",
        cell: ({ row }) => (
          <span className={row.original.assignee ? undefined : "text-on-surface-variant"}>
            {assigneeText(row.original)}
          </span>
        ),
      },
      {
        id: "received",
        header: "Received",
        cell: ({ row }) => (
          <time dateTime={row.original.createdAt} className="whitespace-nowrap">
            {formatAdminDetailDateTime(row.original.createdAt)}
          </time>
        ),
      },
    ],
    [],
  );

  return (
    <EntityTableShell
      table={
        <AdminStaffDataTable
          ariaLabel="Enquiries"
          columns={columns}
          data={items}
          getRowId={rowKey}
          empty={{ title: "No enquiries", description: "Nothing to show." }}
        />
      }
      cards={
        <ul aria-label="Enquiries" className="flex flex-col gap-3">
          {items.map((row) => (
            <EnquiryCard key={rowKey(row)} row={row} />
          ))}
        </ul>
      }
    />
  );
}
