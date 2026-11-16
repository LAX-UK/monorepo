"use client";

import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { enquiryHref } from "@/lib/admin/enquiries/enquiries-search";
import { ENQUIRY_KIND_LABELS } from "@/lib/admin/enquiries/enquiries.vm";
import { QUARANTINE_COPY } from "@/lib/admin/enquiries/enquiry-email-copy";
import {
  QUARANTINE_VIEWS,
  type QuarantineView,
  quarantineHref,
  quarantineListHref,
  reasonCopy,
  subjectLine,
} from "@/lib/admin/enquiries/quarantine.vm";
import type {
  QuarantineListItem,
  QuarantineListPage,
} from "@/lib/data/http/admin-enquiries.schema";
import {
  CellLink,
  type DataColumn,
  DataViews,
  EmptyValue,
  ListPage,
  PrimaryCell,
  StackedCell,
  StatusBadge,
  formatStaffDate,
  formatStaffDateTime,
} from "@auction/staff-ui";
import Link from "next/link";
import { useMemo } from "react";

export type QuarantineListProps = {
  page: QuarantineListPage | null;
  view: QuarantineView;
  /** The next page's address, when there is one; the list pages forward only. */
  nextHref: string | null;
  /** Shown when this is not the first page, to start again. */
  firstHref: string | null;
  loadError: string | null;
  /** The server's clock, so dates read the same on server and browser. */
  now: string;
};

/**
 * Inbound email held back from every enquiry, on the staff list template: who sent it, why it
 * was held, the enquiry its reply address named, when it came and when it will be deleted. A row
 * opens the email; attaching or discarding happens there, after reading it.
 */
export function QuarantineList({
  page,
  view,
  nextHref,
  firstHref,
  loadError,
  now,
}: QuarantineListProps) {
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const clock = useMemo(() => new Date(now), [now]);
  const rows = page?.items ?? [];

  const columns = useMemo<DataColumn<QuarantineListItem>[]>(
    () => [
      {
        id: "from",
        header: QUARANTINE_COPY.columns.from,
        width: "34%",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell
            href={quarantineHref(row.id)}
            Link={Link}
            unread={row.status === "pending"}
            secondary={subjectLine(row.subject)}
          >
            {row.fromAddress}
          </PrimaryCell>
        ),
      },
      {
        id: "reason",
        header: QUARANTINE_COPY.columns.reason,
        width: "180px",
        mobile: "badge",
        truncate: false,
        cell: (row) => {
          const reason = reasonCopy(row);
          return (
            <StatusBadge tone={reason.tone} shape="dot">
              {reason.label}
            </StatusBadge>
          );
        },
      },
      {
        id: "enquiry",
        header: QUARANTINE_COPY.columns.enquiry,
        width: "18%",
        hideBelow: "md",
        mobile: "meta",
        cell: (row) =>
          row.suspectedEnquiry ? (
            <StackedCell secondary={ENQUIRY_KIND_LABELS[row.suspectedEnquiry.intent]}>
              <CellLink href={enquiryHref(row.suspectedEnquiry.reference)} Link={Link}>
                {row.suspectedEnquiry.reference}
              </CellLink>
            </StackedCell>
          ) : (
            <EmptyValue />
          ),
      },
      {
        id: "received",
        header: QUARANTINE_COPY.columns.received,
        width: "170px",
        hideBelow: "lg",
        mobile: "meta",
        cell: (row) => (
          <span className="tabular-nums">{formatStaffDateTime(row.receivedAt, clock)}</span>
        ),
      },
      {
        id: "deleted",
        header: QUARANTINE_COPY.columns.deleted,
        width: "130px",
        hideBelow: "xl",
        mobile: "hidden",
        cell: (row) => (
          <span className="tabular-nums text-staff-muted">
            {formatStaffDate(row.purgeAt, clock)}
          </span>
        ),
      },
    ],
    [clock],
  );

  const empty = QUARANTINE_COPY.empty[view];
  return (
    <ListPage<QuarantineListItem>
      title={QUARANTINE_COPY.title}
      description={QUARANTINE_COPY.description}
      Link={ListLink}
      listKey="bid-admin.enquiry-quarantine"
      access="full"
      views={
        <DataViews
          views={QUARANTINE_VIEWS.map((id) => ({
            id,
            label: QUARANTINE_COPY.views[id],
            href: quarantineListHref(id),
            ...(id === "pending" && page ? { count: page.pendingCount } : {}),
          }))}
          activeId={view}
          Link={ListLink}
        />
      }
      loading={pending}
      filtered={false}
      error={
        loadError
          ? {
              title: QUARANTINE_COPY.loadError,
              description: loadError,
              onRetry: () => navigate(quarantineListHref(view)),
            }
          : null
      }
      empty={{ title: empty.title, description: empty.description }}
      noResults={{ noun: "held email" }}
      table={{
        columns,
        data: rows,
        label: QUARANTINE_COPY.listLabel,
        getRowId: (row) => row.id,
        defaultDensity: "comfortable",
        rowHref: (row) => quarantineHref(row.id),
      }}
      pagination={
        rows.length > 0 && (nextHref || firstHref)
          ? {
              summary:
                view === "pending" && page ? QUARANTINE_COPY.pendingCount(page.pendingCount) : "",
              prevHref: firstHref,
              prevLabel: "First page",
              nextHref,
            }
          : null
      }
    />
  );
}
