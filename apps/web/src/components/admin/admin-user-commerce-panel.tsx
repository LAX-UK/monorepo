"use client";

import { AdminSectionLabel } from "@/components/admin/admin-section-label";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { AdminTableMoneyCell } from "@/components/admin/admin-table-money-cell";
import {
  DetailBoardKpiStrip,
  DetailBoardShell,
  DetailBoardToolbar,
  DetailCardGrid,
  DetailEntityTable,
} from "@/components/admin/catalog/detail-board";
import { MediaImage } from "@/components/ui/media-image";
import { downloadClientBidsCsv } from "@/lib/admin/export-client-bids-csv";
import { formatAdminTableMoney } from "@/lib/admin/format-admin-table-money";
import { connectGapStageLabel } from "@/lib/connect/connect-gap-copy";
import type { AdminPaymentRow, AdminUserBidRow } from "@/lib/data/http/admin.server";
import {
  CLIENT_BID_CHANNEL_FILTERS,
  type ClientBidChannelFilter,
  buildClientPaymentsKpiTiles,
  buildClientWonLotGridItems,
  filterClientBids,
  matchesClientPaymentSearch,
  presentClientBidStatus,
  sortPaymentsRecentFirst,
} from "@/lib/data/view-models/client-commerce-tab.vm";
import { getConnectGapState } from "@auction/connect";
import type { LegalEntity, Lot } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";
import { useMemo, useState } from "react";

export function AdminUserPaymentsPanel({ payments }: { payments: AdminPaymentRow[] }) {
  const [search, setSearch] = useState("");
  const kpiTiles = useMemo(() => buildClientPaymentsKpiTiles(payments), [payments]);
  const filteredPayments = useMemo(
    () =>
      sortPaymentsRecentFirst(payments).filter((payment) =>
        matchesClientPaymentSearch(payment, search),
      ),
    [payments, search],
  );

  return (
    <div className="space-y-6">
      <DetailBoardKpiStrip ariaLabel="Payments summary" tiles={kpiTiles} />
      <DetailBoardShell
        title="Payments"
        description="Captured and outstanding buyer payments."
        count={filteredPayments.length}
        toolbar={
          <DetailBoardToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search payments…"
          />
        }
      >
        <DetailEntityTable
          rows={filteredPayments}
          getRowId={(payment) => payment.id}
          ariaLabel="Client payments"
          emptyTitle="No payments"
          emptyDescription="No payments for this buyer yet."
          columns={[
            {
              id: "lot",
              header: "Lot",
              cell: (payment) => (
                <Link
                  href={`/admin/lots/${payment.lotId}`}
                  className="font-headline text-sm font-medium text-on-surface hover:text-link"
                >
                  Lot {payment.lotId.slice(0, 8)}…
                </Link>
              ),
            },
            {
              id: "amount",
              header: "Amount",
              cell: (payment) => (
                <AdminTableMoneyCell display={formatAdminTableMoney(payment.amount)} />
              ),
            },
            {
              id: "status",
              header: "Status",
              cell: (payment) => (
                <AdminStatusBadge domain="payment" status={payment.status} size="sm" />
              ),
            },
            {
              id: "created",
              header: "Created",
              cell: (payment) => (
                <AdminTableDateTimeCell iso={payment.createdAt.toISOString()} mode="timestamp" />
              ),
            },
            {
              id: "invoice",
              header: "Invoice",
              cell: (payment) =>
                payment.xeroOnlineInvoiceUrl ? (
                  <a
                    href={payment.xeroOnlineInvoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-body text-xs text-link hover:underline"
                  >
                    View
                  </a>
                ) : (
                  <span className="font-body text-xs text-on-surface-variant">—</span>
                ),
            },
          ]}
        />
      </DetailBoardShell>
    </div>
  );
}

export function AdminUserBidsPanel({
  bids,
  clientLabel = "client",
}: {
  bids: AdminUserBidRow[];
  clientLabel?: string;
}) {
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<ClientBidChannelFilter>("all");
  const filteredBids = useMemo(
    () => filterClientBids(bids, { search, channel }),
    [bids, search, channel],
  );

  return (
    <div className="space-y-6">
      <DetailBoardShell
        title="Bidding"
        description="Recent bidding activity for this client."
        count={filteredBids.length}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={bids.length === 0}
            onClick={() => downloadClientBidsCsv(filteredBids, clientLabel)}
          >
            Export
          </Button>
        }
        toolbar={
          <DetailBoardToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search…"
            filters={CLIENT_BID_CHANNEL_FILTERS}
            activeFilter={channel}
            onFilterChange={setChannel}
            filterAriaLabel="Filter bids by channel"
          />
        }
      >
        <DetailEntityTable
          rows={filteredBids}
          getRowId={(bid) => bid.id}
          ariaLabel="Client bids"
          emptyTitle="No bids"
          emptyDescription="This client has not placed any bids yet."
          columns={[
            {
              id: "lot",
              header: "Lot#",
              cell: (bid) => (
                <div className="min-w-0">
                  <Link
                    href={`/admin/lots/${bid.lotId}`}
                    className="font-headline text-sm font-medium text-on-surface hover:text-link"
                  >
                    {bid.lotTitle}
                  </Link>
                  {bid.isAutoBid ? (
                    <p className="mt-0.5 font-body text-[11px] text-on-surface-variant">Auto bid</p>
                  ) : null}
                </div>
              ),
            },
            {
              id: "sale",
              header: "Sale",
              cell: (bid) => (
                <span className="block max-w-[14rem] truncate font-body text-sm text-on-surface">
                  {bid.saleTitle ?? "—"}
                </span>
              ),
            },
            {
              id: "amount",
              header: "Amount",
              cell: (bid) => <AdminTableMoneyCell display={formatAdminTableMoney(bid.amount)} />,
            },
            {
              id: "status",
              header: "Status",
              cell: (bid) => {
                const status = presentClientBidStatus(bid);
                return <DotStatusPill label={status.label} tone={status.tone} />;
              },
            },
            {
              id: "time",
              header: "Time",
              cell: (bid) => (
                <AdminTableDateTimeCell iso={bid.createdAt.toISOString()} mode="timestamp" />
              ),
            },
          ]}
        />
      </DetailBoardShell>
    </div>
  );
}

export function AdminUserWonLotsPanel({ wonLots }: { wonLots: Lot[] }) {
  const items = buildClientWonLotGridItems(wonLots, (lot) =>
    lot.images[0] ? (
      <MediaImage
        src={lot.images[0]}
        alt={lot.title}
        label={lot.title}
        imgClassName="size-full object-cover"
        sizes="(max-width: 640px) 50vw, 320px"
      />
    ) : (
      <div className="flex size-full items-center justify-center font-body text-xs text-on-surface-variant">
        No image
      </div>
    ),
  );

  return (
    <div className="space-y-6">
      <DetailBoardShell
        title="Won lots"
        description="Lots this client has won across all sales."
        count={wonLots.length}
      >
        <DetailCardGrid
          items={items}
          columns={3}
          emptyTitle="This client has not won any lots yet."
        />
      </DetailBoardShell>
    </div>
  );
}

function PanelHeader({ title, summary }: { title: string; summary?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <AdminSectionLabel>{title}</AdminSectionLabel>
      {summary ? (
        <span className="font-headline text-lg tabular-nums text-on-surface">{summary}</span>
      ) : null}
    </div>
  );
}

export function AdminUserLegalEntitiesPanel({ legalEntities }: { legalEntities: LegalEntity[] }) {
  return (
    <Surface variant="quiet" padding="md" className="space-y-3">
      <PanelHeader
        title="Legal entities"
        {...(legalEntities.length > 0 ? { summary: String(legalEntities.length) } : {})}
      />
      {legalEntities.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          No seller organisations created by this user.
        </p>
      ) : (
        <ul className="space-y-3">
          {legalEntities.map((entity) => (
            <li
              key={entity.id}
              className="rounded-md border border-border-hairline bg-surface-container-lowest px-3 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/admin/legal-entities/${entity.id}`}
                  className="font-medium text-link hover:underline"
                >
                  {entity.displayName}
                </Link>
                <AdminStatusBadge domain="legalEntity" status={entity.status} size="sm" />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(() => {
                  const gap = getConnectGapState(entity);
                  return (
                    <>
                      <AdminStatusBadge
                        domain="legalEntity"
                        status={
                          gap.stage === "ready" || gap.stage === "managed_by_lax"
                            ? "approved"
                            : "under_review"
                        }
                        label={connectGapStageLabel(gap.stage)}
                        size="sm"
                      />
                      {gap.missing.length > 0 ? (
                        <AdminStatusBadge
                          domain="legalEntity"
                          status="restricted"
                          label={`${gap.missing.length} requirement(s) due`}
                          size="sm"
                        />
                      ) : null}
                    </>
                  );
                })()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}
