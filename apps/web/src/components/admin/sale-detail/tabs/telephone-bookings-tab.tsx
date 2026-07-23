"use client";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { CatalogDetailTabCard } from "@/components/admin/catalog";
import {
  DetailBoardKpiStrip,
  DetailBoardToolbar,
  DetailEntityTable,
} from "@/components/admin/catalog/detail-board";
import { SaleStatusPill } from "@/components/admin/sale-detail/sale-status-pill";
import { TelephoneBookingActionCard } from "@/components/admin/sale-detail/tabs/telephone-booking-action-card";
import { downloadSaleTelephoneBookingsCsv } from "@/lib/admin/export-sale-telephone-bookings-csv";
import type { AdminTelephoneBookingRow } from "@/lib/data/http/admin.server";
import {
  SALE_TELEPHONE_FILTERS,
  type SaleTelephoneFilter,
  buildSaleTelephoneKpiTiles,
  filterSaleTelephoneBookings,
  matchesSaleTelephoneSearch,
  telephoneBidderLabel,
} from "@/lib/data/view-models/sale-telephone-tab.vm";
import { telephoneBookingDotStatus } from "@/lib/presenters/status/dot-status-presenters";
import { formatMoney } from "@/lib/ui/format";
import type { Sale } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { useMemo, useState } from "react";

type Props = {
  saleId: string;
  sale: Sale;
  liveish: boolean;
  rows: AdminTelephoneBookingRow[];
  fetchError: string | null;
  actionError: string | null;
};

export function SaleTelephoneBookingsTab({
  saleId,
  sale,
  liveish,
  rows,
  fetchError,
  actionError,
}: Props) {
  const [filter, setFilter] = useState<SaleTelephoneFilter>("all");
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(
    () =>
      filterSaleTelephoneBookings(rows, filter).filter((row) =>
        matchesSaleTelephoneSearch(row, search),
      ),
    [rows, filter, search],
  );

  const activeRows = filteredRows.filter(
    (r) => r.status !== "cancelled" && r.status !== "completed",
  );
  const archivedRows = filteredRows.filter(
    (r) => r.status === "cancelled" || r.status === "completed",
  );

  if (!liveish) {
    return (
      <p className="font-body text-sm text-on-surface-variant">
        Telephone bookings open when the sale is scheduled or live. Current status:{" "}
        <SaleStatusPill status={sale.status} />
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <DetailBoardKpiStrip
        ariaLabel="Telephone bookings summary"
        tiles={buildSaleTelephoneKpiTiles(rows)}
      />

      <CatalogDetailTabCard
        title="Telephone bookings"
        description="Confirm lines, assign clerks, and manage in-progress telephone bidding."
        countBadge={rows.length}
        toolbar={
          <DetailBoardToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search bookings…"
            filters={SALE_TELEPHONE_FILTERS}
            activeFilter={filter}
            onFilterChange={setFilter}
            filterAriaLabel="Filter telephone bookings"
            trailing={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={rows.length === 0}
                onClick={() => downloadSaleTelephoneBookingsCsv(rows, sale.title)}
              >
                Export
              </Button>
            }
          />
        }
        footer={
          filteredRows.length > 0 ? (
            <span>
              Showing {filteredRows.length} of {rows.length} booking
              {rows.length === 1 ? "" : "s"}
            </span>
          ) : undefined
        }
      >
        {actionError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Action failed</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}
        {fetchError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Could not load bookings</AlertTitle>
            <AlertDescription>{fetchError}</AlertDescription>
          </Alert>
        ) : null}

        {!fetchError && rows.length === 0 ? (
          <AdminEmptyState
            title="No telephone bookings"
            description="Buyer telephone line requests will appear here."
          />
        ) : null}

        {activeRows.length > 0 ? (
          <div className="mb-6 space-y-3">
            <h3 className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              Active lines
            </h3>
            {activeRows.map((row) => (
              <TelephoneBookingActionCard key={row.id} saleId={saleId} row={row} />
            ))}
          </div>
        ) : null}

        {archivedRows.length > 0 ? (
          <DetailEntityTable
            rows={archivedRows}
            getRowId={(row) => row.id}
            emptyTitle="No archived bookings"
            columns={[
              {
                id: "bidder",
                header: "Bidder",
                cell: (row) => (
                  <div className="min-w-0">
                    <p className="font-headline text-sm font-medium text-on-surface">
                      {telephoneBidderLabel(row)}
                    </p>
                    {row.userEmail ? (
                      <p className="font-body text-xs text-on-surface-variant">{row.userEmail}</p>
                    ) : null}
                  </div>
                ),
              },
              {
                id: "phone",
                header: "Phone",
                cell: (row) => (
                  <a href={`tel:${row.phoneE164}`} className="text-link hover:underline">
                    {row.phoneDisplay ?? row.phoneE164}
                  </a>
                ),
              },
              {
                id: "status",
                header: "Status",
                cell: (row) => {
                  const presentation = telephoneBookingDotStatus(row.status);
                  return <DotStatusPill label={presentation.label} tone={presentation.tone} />;
                },
              },
              {
                id: "authorized",
                header: "Authorized max",
                cell: (row) => (
                  <span className="font-body text-sm tabular-nums text-on-surface-variant">
                    {row.authorizedMax ? formatMoney(row.authorizedMax) : "—"}
                  </span>
                ),
              },
              {
                id: "requested",
                header: "Requested",
                cell: (row) => <AdminTableDateTimeCell iso={row.createdAt} mode="timestamp" />,
              },
            ]}
          />
        ) : null}
      </CatalogDetailTabCard>
    </div>
  );
}
