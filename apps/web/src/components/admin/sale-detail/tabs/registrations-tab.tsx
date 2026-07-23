"use client";

import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { AssignPaddleDialog } from "@/components/admin/assign-paddle-dialog";
import { CatalogDetailTabCard } from "@/components/admin/catalog";
import {
  DetailBoardKpiStrip,
  DetailBoardToolbar,
  DetailEntityTable,
} from "@/components/admin/catalog/detail-board";
import { ExpectedGuestsPanel } from "@/components/admin/expected-guests-panel";
import { SaleStatusPill } from "@/components/admin/sale-detail/sale-status-pill";
import { SaleRegistrationRejectButton } from "@/components/admin/sale-registration-reject-button";
import { SaleroomCheckInPanel } from "@/components/admin/saleroom-check-in-panel";
import { adminApproveSaleRegistrationAction } from "@/lib/actions/admin";
import { downloadSaleRegistrationsCsv } from "@/lib/admin/export-sale-registrations-csv";
import type { AdminExpectedGuestsSummary } from "@/lib/data/http/admin-expected-guests.server";
import type { AdminSaleRegistrationRow } from "@/lib/data/http/admin-sale-registrations.types";
import {
  SALE_REGISTRATIONS_FILTERS,
  type SaleRegistrationsFilter,
  buildSaleRegistrationsKpiTiles,
  filterSaleRegistrations,
  matchesSaleRegistrationSearch,
  registrationBidderLabel,
  registrationCheckInLabel,
  registrationCheckInTone,
  registrationStatusLabel,
  registrationStatusTone,
} from "@/lib/data/view-models/sale-registrations-tab.vm";
import type { Sale } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { isSaleroomDeliveryMode } from "@auction/validators";
import { useMemo, useState } from "react";

type Props = {
  saleId: string;
  sale: Sale;
  liveish: boolean;
  rows: AdminSaleRegistrationRow[];
  fetchError: string | null;
  actionError: string | null;
  saleCurrency?: string;
  expectedGuests?: AdminExpectedGuestsSummary | null;
};

function RegistrationTableActions({
  saleId,
  row,
  showSaleroomCheckIn,
}: {
  saleId: string;
  row: AdminSaleRegistrationRow;
  showSaleroomCheckIn: boolean;
}) {
  const [paddleDialogOpen, setPaddleDialogOpen] = useState(false);

  if (row.status === "pending") {
    return (
      <div className="flex items-center justify-end gap-2">
        <form action={adminApproveSaleRegistrationAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <input type="hidden" name="registrationId" value={row.id} />
          <Button type="submit" size="sm" variant="ghost" className="h-8 px-2 font-label text-xs">
            Approve
          </Button>
        </form>
        <SaleRegistrationRejectButton
          saleId={saleId}
          registrationId={row.id}
          reasonFieldId={`reject-reason-${row.id}`}
        />
      </div>
    );
  }

  const canAssignPaddle =
    showSaleroomCheckIn && row.status === "approved" && row.paddleNumber == null;

  return (
    <div className="flex items-center justify-end gap-2">
      {canAssignPaddle ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 font-label text-xs"
            onClick={() => setPaddleDialogOpen(true)}
          >
            Assign paddle
          </Button>
          <AssignPaddleDialog
            saleId={saleId}
            row={row}
            open={paddleDialogOpen}
            onOpenChange={setPaddleDialogOpen}
          />
        </>
      ) : null}
      <Button variant="ghost" size="sm" className="h-8 px-2 font-label text-xs" asChild>
        <a href={`#registration-${row.id}`}>View</a>
      </Button>
    </div>
  );
}

export function SaleRegistrationsTab({
  saleId,
  sale,
  liveish,
  rows,
  fetchError,
  actionError,
  saleCurrency = "GBP",
  expectedGuests = null,
}: Props) {
  const showSaleroomCheckIn = isSaleroomDeliveryMode(sale.deliveryMode);
  const [filter, setFilter] = useState<SaleRegistrationsFilter>("all");
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(
    () =>
      filterSaleRegistrations(rows, filter).filter((row) =>
        matchesSaleRegistrationSearch(row, search),
      ),
    [rows, filter, search],
  );

  if (!liveish) {
    return (
      <p className="font-body text-sm text-on-surface-variant">
        Registrations open when the sale is scheduled or live. Current status:{" "}
        <SaleStatusPill status={sale.status} />
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <DetailBoardKpiStrip
        ariaLabel="Registrations summary"
        tiles={buildSaleRegistrationsKpiTiles(rows)}
      />

      {expectedGuests?.eventSlug && expectedGuests.items.length > 0 ? (
        <ExpectedGuestsPanel
          saleId={saleId}
          deliveryMode={sale.deliveryMode}
          eventSlug={expectedGuests.eventSlug}
          eventTitle={expectedGuests.eventTitle ?? expectedGuests.eventSlug}
          segmentOptions={expectedGuests.segmentOptions}
          items={expectedGuests.items}
        />
      ) : null}

      {showSaleroomCheckIn ? (
        <SaleroomCheckInPanel
          saleId={saleId}
          saleCurrency={saleCurrency}
          deliveryMode={sale.deliveryMode}
        />
      ) : null}

      <CatalogDetailTabCard
        title="Registrations"
        description={
          showSaleroomCheckIn
            ? "Approve registrations and assign in-room paddle numbers at check-in."
            : "Approve or reject registration requests before and during the live sale."
        }
        countBadge={rows.length}
        toolbar={
          <DetailBoardToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search registrations…"
            filters={SALE_REGISTRATIONS_FILTERS}
            activeFilter={filter}
            onFilterChange={setFilter}
            filterAriaLabel="Filter registrations"
            trailing={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={rows.length === 0}
                onClick={() => downloadSaleRegistrationsCsv(rows, sale.title)}
              >
                Export
              </Button>
            }
          />
        }
        footer={
          filteredRows.length > 0 ? (
            <span>
              Showing {filteredRows.length} of {rows.length} registration
              {rows.length === 1 ? "" : "s"}
            </span>
          ) : undefined
        }
      >
        {actionError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}
        {fetchError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Could not load registrations</AlertTitle>
            <AlertDescription>{fetchError}</AlertDescription>
          </Alert>
        ) : null}

        <DetailEntityTable
          rows={filteredRows}
          getRowId={(row) => row.id}
          emptyTitle="No matching registrations"
          emptyDescription={
            showSaleroomCheckIn
              ? "No pending requests — use check-in above for walk-ins."
              : "Buyers who request to bid on this sale will appear here for approval."
          }
          columns={[
            {
              id: "bidder",
              header: "Bidder",
              cell: (row) => (
                <div className="min-w-0">
                  <p className="font-headline text-sm font-medium text-on-surface">
                    {registrationBidderLabel(row)}
                  </p>
                  {row.userEmail && row.userEmail !== (row.userName ?? "") ? (
                    <p className="font-body text-xs text-on-surface-variant">{row.userEmail}</p>
                  ) : null}
                </div>
              ),
            },
            {
              id: "paddle",
              header: "Paddle",
              cell: (row) =>
                row.paddleNumber != null ? (
                  <span className="font-headline text-sm tabular-nums text-on-surface">
                    {row.paddleNumber}
                  </span>
                ) : (
                  <span className="font-body text-sm text-on-surface-variant">—</span>
                ),
            },
            {
              id: "status",
              header: "Status",
              cell: (row) => (
                <DotStatusPill
                  label={registrationStatusLabel(row.status)}
                  tone={registrationStatusTone(row.status)}
                />
              ),
            },
            {
              id: "check-in",
              header: "Check-in",
              cell: (row) => (
                <DotStatusPill
                  label={registrationCheckInLabel(row)}
                  tone={registrationCheckInTone(row)}
                />
              ),
            },
            {
              id: "date",
              header: "Requested",
              cell: (row) =>
                row.requestedAt ? (
                  <AdminTableDateTimeCell iso={row.requestedAt} mode="timestamp" />
                ) : (
                  <span className="font-body text-sm text-on-surface-variant">—</span>
                ),
            },
            {
              id: "actions",
              header: "",
              headerClassName: "sr-only",
              className: "text-right",
              cell: (row) => (
                <RegistrationTableActions
                  saleId={saleId}
                  row={row}
                  showSaleroomCheckIn={showSaleroomCheckIn}
                />
              ),
            },
          ]}
        />
      </CatalogDetailTabCard>
    </div>
  );
}
