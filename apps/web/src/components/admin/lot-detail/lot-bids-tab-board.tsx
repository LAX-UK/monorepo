"use client";

import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import type { LotBidTableRow } from "@/lib/data/view-models/lot-bids-tab.vm";
import {
  type DataColumn,
  PersonCell,
  StaffDate,
  type StaffLinkComponent,
  StaffMoney,
  StatusBadge,
  parsePoundsToPence,
  rowActionsColumn,
} from "@auction/staff-ui";
import { UserRound } from "lucide-react";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

type Props = {
  lotId: string;
  rows: LotBidTableRow[];
  /** Only the latest bids were loaded. */
  capped?: boolean;
};

function pence(amount: string | null): number | null {
  if (!amount) return null;
  const parsed = parsePoundsToPence(amount);
  return parsed.ok ? parsed.pence : null;
}

const columns: DataColumn<LotBidTableRow>[] = [
  {
    id: "amount",
    header: "Amount",
    numeric: true,
    width: "140px",
    sortable: true,
    defaultSortDirection: "desc",
    sortValue: (row) => pence(row.amount),
    mobile: "title",
    cell: (row) => <StaffMoney minor={pence(row.amount)} />,
  },
  {
    id: "state",
    header: "Standing",
    width: "120px",
    mobile: "badge",
    cell: (row) =>
      row.isWinning ? <StatusBadge tone="success">Winning</StatusBadge> : <span>Outbid</span>,
  },
  {
    id: "bidder",
    header: "Bidder",
    mobile: "meta",
    cell: (row) => (
      <PersonCell
        name={row.bidderLabel}
        {...(row.bidderId ? { href: `/admin/clients/${row.bidderId}`, Link: NextLink } : {})}
      />
    ),
  },
  {
    id: "type",
    header: "Type",
    hideBelow: "md",
    cell: (row) =>
      row.isAutoBid ? (
        <span className="flex flex-col">
          <span>Automatic</span>
          {row.maxAutoBidAmount ? (
            <span className="text-staff-xs text-staff-muted">
              Up to <StaffMoney minor={pence(row.maxAutoBidAmount)} />
            </span>
          ) : null}
        </span>
      ) : (
        "Placed by the bidder"
      ),
  },
  {
    id: "placed",
    header: "Placed",
    width: "180px",
    sortable: true,
    defaultSortDirection: "desc",
    sortValue: (row) => new Date(row.placedAtIso).getTime(),
    mobile: "meta",
    cell: (row) => <StaffDate value={row.placedAtIso} withTime />,
  },
  rowActionsColumn<LotBidTableRow>({
    label: (row) => `Actions for the bid from ${row.bidderLabel}`,
    Link: NextLink,
    actions: (row) =>
      row.bidderId
        ? [
            {
              id: "bidder",
              label: "Open bidder",
              icon: UserRound,
              href: `/admin/clients/${row.bidderId}`,
            },
          ]
        : [],
  }),
];

/** Every bid on the lot, newest first, with who placed it and whether it is winning. */
export function LotBidsTabBoard({ rows, capped = false }: Props) {
  return (
    <RelatedRecordsSection<LotBidTableRow>
      title="Bids"
      label="Bids on this lot"
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      defaultSort={{ columnId: "placed", direction: "desc" }}
      density="comfortable"
      empty={{
        title: "No bids yet",
        description: "Bids appear here once the lot is open and bidders place them.",
      }}
      {...(capped ? { footer: "Showing the latest 100 bids." } : {})}
    />
  );
}
