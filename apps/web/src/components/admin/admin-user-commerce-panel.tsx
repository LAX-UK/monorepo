"use client";

import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import { downloadClientBidsCsv } from "@/lib/admin/export-client-bids-csv";
import { staffStatus, toStaffStatus } from "@/lib/admin/staff-kit-status";
import { connectGapStageBadgeVariant, connectGapStageLabel } from "@/lib/connect/connect-gap-copy";
import type { AdminPaymentRow, AdminUserBidRow } from "@/lib/data/http/admin.server";
import {
  CLIENT_BID_CHANNEL_OPTIONS,
  type ClientBidChannelFilter,
  buildClientPaymentStats,
  clientBidChannelLabel,
  decimalToMinorUnits,
  filterClientBids,
  presentClientBidStatus,
} from "@/lib/data/view-models/client-commerce-tab.vm";
import { getConnectGapState } from "@auction/connect";
import {
  CellLink,
  type DataColumn,
  DataTableToolbar,
  PrimaryCell,
  SegmentedControl,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StaffMoney,
  StatGrid,
  StatusBadge,
  TableSearch,
} from "@auction/staff-ui";
import type { LegalEntity, Lot } from "@auction/types";
import Link from "next/link";
import { useMemo, useState } from "react";

const NextLink: StaffLinkComponent = Link;

const paymentColumns: DataColumn<AdminPaymentRow>[] = [
  {
    id: "created",
    header: "Created",
    numeric: true,
    sortable: true,
    defaultSortDirection: "desc",
    width: "176px",
    mobile: "meta",
    sortValue: (payment) => payment.createdAt.getTime(),
    cell: (payment) => <StaffDate value={payment.createdAt} withTime />,
  },
  {
    id: "lot",
    header: "Lot",
    mobile: "title",
    cell: (payment) => (
      <CellLink Link={NextLink} href={`/admin/lots/${encodeURIComponent(payment.lotId)}`}>
        Open lot
      </CellLink>
    ),
  },
  {
    id: "amount",
    header: "Amount",
    numeric: true,
    sortable: true,
    defaultSortDirection: "desc",
    width: "128px",
    mobile: "meta",
    sortValue: (payment) => decimalToMinorUnits(payment.amount),
    cell: (payment) => <StaffMoney minor={decimalToMinorUnits(payment.amount)} />,
  },
  {
    id: "status",
    header: "Status",
    width: "176px",
    mobile: "badge",
    truncate: false,
    cell: (payment) => {
      const status = staffStatus("payment", payment.status);
      return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
    },
  },
  {
    id: "invoice",
    header: "Invoice",
    width: "144px",
    hideBelow: "md",
    mobile: "hidden",
    cell: (payment) =>
      payment.xeroOnlineInvoiceUrl ? (
        <CellLink href={payment.xeroOnlineInvoiceUrl} external>
          {payment.xeroInvoiceNumber ?? "View invoice"}
        </CellLink>
      ) : (
        (payment.xeroInvoiceNumber ?? null)
      ),
  },
];

/** What this buyer has paid and owes: headline numbers, then each payment, newest first. */
export function AdminUserPaymentsPanel({ payments }: { payments: AdminPaymentRow[] }) {
  const stats = useMemo(() => buildClientPaymentStats(payments), [payments]);

  return (
    <>
      <StatGrid label="Payments summary" items={stats} />
      <RelatedRecordsSection
        id="payments"
        title="Payments"
        description="Captured and outstanding payments from this buyer."
        label="Client payments"
        columns={paymentColumns}
        data={payments}
        getRowId={(payment) => payment.id}
        defaultSort={{ columnId: "created", direction: "desc" }}
        empty={{
          title: "No payments yet",
          description: "Payments appear here once this client has won a lot and been invoiced.",
        }}
      />
    </>
  );
}

const bidColumns: DataColumn<AdminUserBidRow>[] = [
  {
    id: "lot",
    header: "Lot",
    mobile: "title",
    sortable: true,
    sortValue: (bid) => bid.lotTitle.toLowerCase(),
    cell: (bid) => (
      <PrimaryCell
        Link={NextLink}
        href={`/admin/lots/${encodeURIComponent(bid.lotId)}`}
        secondary={bid.isAutoBid ? "Automatic bid" : null}
      >
        {bid.lotTitle}
      </PrimaryCell>
    ),
  },
  {
    id: "sale",
    header: "Sale",
    hideBelow: "lg",
    mobile: "meta",
    cell: (bid) =>
      bid.saleId && bid.saleTitle ? (
        <CellLink Link={NextLink} href={`/admin/sales/${encodeURIComponent(bid.saleId)}`}>
          {bid.saleTitle}
        </CellLink>
      ) : (
        (bid.saleTitle ?? null)
      ),
  },
  {
    id: "channel",
    header: "Placed",
    width: "128px",
    hideBelow: "lg",
    mobile: "hidden",
    cell: (bid) => <span className="text-staff-muted">{clientBidChannelLabel(bid.placedVia)}</span>,
  },
  {
    id: "amount",
    header: "Amount",
    numeric: true,
    sortable: true,
    defaultSortDirection: "desc",
    width: "128px",
    mobile: "meta",
    sortValue: (bid) => decimalToMinorUnits(bid.amount),
    cell: (bid) => <StaffMoney minor={decimalToMinorUnits(bid.amount)} />,
  },
  {
    id: "result",
    header: "Result",
    width: "128px",
    mobile: "badge",
    truncate: false,
    cell: (bid) => {
      const status = presentClientBidStatus(bid);
      return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
    },
  },
  {
    id: "time",
    header: "Time",
    numeric: true,
    sortable: true,
    defaultSortDirection: "desc",
    width: "176px",
    mobile: "hidden",
    sortValue: (bid) => bid.createdAt.getTime(),
    cell: (bid) => <StaffDate value={bid.createdAt} withTime />,
  },
];

/** The most recent bids this client placed, searchable and filterable by channel. */
export function AdminUserBidsPanel({
  bids,
  total,
  clientLabel = "client",
}: {
  bids: AdminUserBidRow[];
  /** All bids this client has placed, when more than `bids` shows. */
  total?: number;
  clientLabel?: string;
}) {
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<ClientBidChannelFilter>("all");
  const filtered = useMemo(
    () => filterClientBids(bids, { search, channel }),
    [bids, search, channel],
  );
  const filtering = search.trim() !== "" || channel !== "all";

  return (
    <RelatedRecordsSection
      id="bids"
      title="Bids"
      description="Recent bidding by this client, newest first."
      label="Client bids"
      columns={bidColumns}
      data={filtered}
      getRowId={(bid) => bid.id}
      defaultSort={{ columnId: "time", direction: "desc" }}
      toolbar={
        <DataTableToolbar
          search={
            <TableSearch
              live
              label="Search bids"
              placeholder="Lot, sale or amount"
              value={search}
              onSearch={setSearch}
            />
          }
          filters={
            <SegmentedControl<ClientBidChannelFilter>
              label="Channel"
              value={channel}
              onValueChange={setChannel}
              options={CLIENT_BID_CHANNEL_OPTIONS}
            />
          }
          end={
            <StaffButton
              size="sm"
              variant="secondary"
              {...(filtered.length === 0 ? { disabledReason: "There are no bids to export" } : {})}
              onClick={() => downloadClientBidsCsv(filtered, clientLabel)}
            >
              Export CSV
            </StaffButton>
          }
        />
      }
      empty={
        filtering
          ? { title: "No bids match", description: "Try a different search or channel." }
          : {
              title: "No bids yet",
              description: "Bids appear here once this client starts bidding.",
            }
      }
      {...(total != null && total > bids.length
        ? { footer: `Showing the latest ${bids.length} of ${total} bids.` }
        : {})}
    />
  );
}

const wonLotColumns: DataColumn<Lot>[] = [
  {
    id: "lot",
    header: "Lot",
    mobile: "title",
    sortable: true,
    sortValue: (lot) => lot.title.toLowerCase(),
    cell: (lot) => (
      <PrimaryCell
        Link={NextLink}
        href={`/admin/lots/${encodeURIComponent(lot.id)}`}
        thumbnail={{ src: lot.images[0] ?? null, missingLabel: "No photo yet" }}
        secondary={lot.lotNumber != null ? `Lot ${lot.lotNumber}` : null}
      >
        {lot.title}
      </PrimaryCell>
    ),
  },
  {
    id: "ended",
    header: "Ended",
    numeric: true,
    sortable: true,
    defaultSortDirection: "desc",
    width: "176px",
    mobile: "meta",
    sortValue: (lot) => new Date(lot.endTime).getTime(),
    cell: (lot) => <StaffDate value={lot.endTime} withTime />,
  },
  {
    id: "price",
    header: "Winning bid",
    numeric: true,
    sortable: true,
    defaultSortDirection: "desc",
    width: "144px",
    mobile: "meta",
    sortValue: (lot) => decimalToMinorUnits(lot.currentPrice),
    cell: (lot) => <StaffMoney minor={decimalToMinorUnits(lot.currentPrice)} />,
  },
];

/** Lots this client has won, most recently ended first. */
export function AdminUserWonLotsPanel({ wonLots }: { wonLots: Lot[] }) {
  return (
    <RelatedRecordsSection
      id="won-lots"
      title="Won lots"
      description="Lots this client has won across all sales."
      label="Won lots"
      columns={wonLotColumns}
      data={wonLots}
      getRowId={(lot) => lot.id}
      defaultSort={{ columnId: "ended", direction: "desc" }}
      empty={{
        title: "No won lots yet",
        description: "Lots this client wins appear here.",
      }}
    />
  );
}

const entityColumns: DataColumn<LegalEntity>[] = [
  {
    id: "name",
    header: "Name",
    mobile: "title",
    sortable: true,
    sortValue: (entity) => entity.displayName.toLowerCase(),
    cell: (entity) => (
      <PrimaryCell Link={NextLink} href={`/admin/legal-entities/${encodeURIComponent(entity.id)}`}>
        {entity.displayName}
      </PrimaryCell>
    ),
  },
  {
    id: "status",
    header: "Status",
    width: "160px",
    mobile: "badge",
    truncate: false,
    cell: (entity) => {
      const status = staffStatus("legalEntity", entity.status);
      return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
    },
  },
  {
    id: "setup",
    header: "Seller setup",
    width: "280px",
    hideBelow: "md",
    mobile: "meta",
    truncate: false,
    cell: (entity) => {
      const gap = getConnectGapState(entity);
      const stage = toStaffStatus(
        connectGapStageBadgeVariant(gap.stage),
        connectGapStageLabel(gap.stage),
      );
      return (
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={stage.tone}>{stage.label}</StatusBadge>
          {gap.missing.length > 0 ? (
            <span className="text-staff-muted">
              {gap.missing.length} {gap.missing.length === 1 ? "requirement" : "requirements"} due
            </span>
          ) : null}
        </span>
      );
    },
  },
];

/** The seller organisations this client created, with their account status and payout setup. */
export function AdminUserLegalEntitiesPanel({ legalEntities }: { legalEntities: LegalEntity[] }) {
  return (
    <RelatedRecordsSection
      id="legal-entities"
      title="Legal entities"
      description="Seller organisations created by this client."
      label="Legal entities"
      columns={entityColumns}
      data={legalEntities}
      getRowId={(entity) => entity.id}
      defaultSort={{ columnId: "name", direction: "asc" }}
      empty={{
        title: "No legal entities",
        description: "Seller organisations this client creates appear here.",
      }}
    />
  );
}
