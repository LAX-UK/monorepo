"use client";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { PaddleCheckInControls } from "@/components/admin/paddle-check-in-controls";
import { SaleRegistrationRejectButton } from "@/components/admin/sale-registration-reject-button";
import { SaleroomCheckInPanel } from "@/components/admin/saleroom-check-in-panel";
import {
  adminApproveSaleRegistrationAction,
  adminUpdateSaleRegistrationBidLimitAction,
} from "@/lib/actions/admin";
import { saleStatusLabel } from "@/lib/admin/status-badge-variants";
import type { AdminSaleRegistrationRow } from "@/lib/data/http/admin.server";
import {
  BID_LIMIT_FIELD_LABEL,
  bidLimitFieldHelp,
  bidLimitFieldPlaceholder,
} from "@/lib/saleroom/bid-limit-field-copy";
import { formatDateTime } from "@/lib/ui/format";
import type { SaleDeliveryMode, SaleStatus } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { isSaleroomDeliveryMode } from "@auction/validators";
import { useEffect, useMemo, useState } from "react";

type RegistrationFilter = "all" | "pending" | "approved" | "checked_in" | "awaiting_paddle";

function RegistrationBidLimitEdit({
  saleId,
  registrationId,
  bidLimit,
  saleCurrency = "GBP",
}: {
  saleId: string;
  registrationId: string;
  bidLimit: string | null;
  saleCurrency?: string;
}) {
  const [value, setValue] = useState(bidLimit?.replace(/\.00$/, "") ?? "");

  return (
    <form
      action={adminUpdateSaleRegistrationBidLimitAction}
      className="mt-2 flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="saleId" value={saleId} />
      <input type="hidden" name="registrationId" value={registrationId} />
      <div className="space-y-1">
        <label
          htmlFor={`bid-limit-${registrationId}`}
          className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary"
        >
          {BID_LIMIT_FIELD_LABEL}
        </label>
        <input
          id={`bid-limit-${registrationId}`}
          name="bidLimit"
          type="number"
          min={1}
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={bidLimitFieldPlaceholder(saleCurrency)}
          className="h-9 w-32 rounded-md border border-border-hairline bg-surface px-2 font-body text-sm tabular-nums"
        />
        <p className="font-body text-[10px] text-on-surface-variant">
          {bidLimitFieldHelp(saleCurrency)}
        </p>
      </div>
      <Button type="submit" size="sm" variant="outline" className="min-h-9">
        Save limit
      </Button>
    </form>
  );
}

function RegistrationRow({
  saleId,
  row,
  showPaddleCheckIn,
}: {
  saleId: string;
  row: AdminSaleRegistrationRow;
  showPaddleCheckIn: boolean;
}) {
  const pending = row.status === "pending";
  return (
    <div className="rounded-lg border border-border-hairline bg-surface-container-low/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{row.userName ?? row.userEmail ?? row.userId}</p>
          {row.userEmail && row.userEmail !== (row.userName ?? "") ? (
            <p className="font-body text-xs text-on-surface-variant">{row.userEmail}</p>
          ) : null}
          {row.buyerLegalEntityDisplayName ? (
            <p className="font-body text-xs text-on-surface-variant">
              Entity: {row.buyerLegalEntityDisplayName}
            </p>
          ) : null}
          {row.memberRole ? (
            <p className="font-body text-xs text-on-surface-variant">Role: {row.memberRole}</p>
          ) : null}
          {row.bidLimit && row.status !== "approved" ? (
            <p className="font-body text-xs text-on-surface-variant">Limit: {row.bidLimit}</p>
          ) : null}
          {row.status === "approved" ? (
            <RegistrationBidLimitEdit
              saleId={saleId}
              registrationId={row.id}
              bidLimit={row.bidLimit}
            />
          ) : null}
          {row.paddleNumber != null ? (
            <p className="font-headline text-lg tabular-nums text-on-surface">
              Paddle {row.paddleNumber}
            </p>
          ) : null}
          {row.checkedInAt ? (
            <p className="font-body text-xs text-on-surface-variant">
              Checked in: {formatDateTime(row.checkedInAt)}
            </p>
          ) : null}
          {row.requestedAt ? (
            <p className="font-body text-xs text-on-surface-variant">
              Requested: {formatDateTime(row.requestedAt)}
            </p>
          ) : null}
          {row.rejectionReason && row.status === "rejected" ? (
            <p className="mt-1 font-body text-xs text-error">Reason: {row.rejectionReason}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-3">
          <AdminStatusBadge domain="registration" status={row.status} />
          {pending ? (
            <div className="flex flex-wrap justify-end gap-2">
              <form action={adminApproveSaleRegistrationAction}>
                <input type="hidden" name="saleId" value={saleId} />
                <input type="hidden" name="registrationId" value={row.id} />
                <Button type="submit" size="sm" variant="default" className="min-h-9">
                  Approve
                </Button>
              </form>
              <SaleRegistrationRejectButton
                saleId={saleId}
                registrationId={row.id}
                reasonFieldId={`reject-reason-${row.id}`}
              />
            </div>
          ) : null}
        </div>
      </div>
      {showPaddleCheckIn ? <PaddleCheckInControls saleId={saleId} row={row} /> : null}
    </div>
  );
}

function matchesFilter(row: AdminSaleRegistrationRow, filter: RegistrationFilter): boolean {
  if (filter === "all") return true;
  if (filter === "pending") return row.status === "pending";
  if (filter === "approved") return row.status === "approved";
  if (filter === "checked_in") return row.checkedInAt != null;
  if (filter === "awaiting_paddle") return row.status === "approved" && row.paddleNumber == null;
  return true;
}

function matchesSearch(row: AdminSaleRegistrationRow, needle: string): boolean {
  if (!needle) return true;
  const q = needle.toLowerCase();
  const fields = [
    row.userName,
    row.userEmail,
    row.paddleNumber != null ? String(row.paddleNumber) : null,
  ];
  return fields.some((f) => f?.toLowerCase().includes(q));
}

type Props = {
  saleId: string;
  saleStatus: SaleStatus;
  deliveryMode: SaleDeliveryMode;
  liveish: boolean;
  rows: AdminSaleRegistrationRow[];
  fetchError?: string | null;
  actionError?: string | null;
};

export function SaleRegistrationsTabSection({
  saleId,
  saleStatus,
  deliveryMode,
  liveish,
  rows,
  fetchError = null,
  actionError = null,
}: Props) {
  const showSaleroomCheckIn = isSaleroomDeliveryMode(deliveryMode);
  const pendingApprovals = rows.filter((r) => r.status === "pending");
  const defaultFilter: RegistrationFilter =
    showSaleroomCheckIn && saleStatus === "active" && pendingApprovals.length === 0
      ? "awaiting_paddle"
      : "all";
  const [filter, setFilter] = useState<RegistrationFilter>(defaultFilter);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#check-in") return;
    const el = document.getElementById("check-in");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    el?.classList.add("ring-2", "ring-primary/40");
    const timer = window.setTimeout(() => {
      el?.classList.remove("ring-2", "ring-primary/40");
    }, 2000);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => matchesFilter(r, filter) && matchesSearch(r, needle));
  }, [rows, filter, search]);

  const checkedInCount = rows.filter((r) => r.checkedInAt != null).length;
  const paddleRosterCount = rows.filter((r) => r.paddleNumber != null).length;

  if (!liveish) {
    return (
      <p className="font-body text-sm text-on-surface-variant">
        Registrations open when the sale is scheduled or live. Current status:{" "}
        <strong>{saleStatusLabel[saleStatus]}</strong>.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {showSaleroomCheckIn ? <SaleroomCheckInPanel saleId={saleId} saleCurrency="GBP" /> : null}

      {showSaleroomCheckIn ? (
        <div className="flex flex-wrap items-center gap-3 font-body text-xs text-on-surface-variant">
          <span>
            Paddle roster:{" "}
            <strong className="tabular-nums text-on-surface">{paddleRosterCount}</strong>
          </span>
          <span>
            Checked in: <strong className="tabular-nums text-on-surface">{checkedInCount}</strong>
          </span>
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Registration requests
          </p>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter name, email, paddle #"
            className="h-9 w-full max-w-xs rounded-md border border-border-hairline bg-surface px-3 font-body text-sm sm:w-56"
            aria-label="Filter registrations"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["pending", "Pending"],
              ["approved", "Approved"],
              ["checked_in", "Checked in"],
              ["awaiting_paddle", "Awaiting paddle"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={filter === id ? "default" : "outline"}
              onClick={() => setFilter(id)}
            >
              {label}
            </Button>
          ))}
        </div>

        <p className="font-body text-sm text-on-surface-variant">
          {rows.length} registration{rows.length === 1 ? "" : "s"} · {pendingApprovals.length}{" "}
          pending
        </p>

        {actionError ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}
        {fetchError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load registrations</AlertTitle>
            <AlertDescription>{fetchError}</AlertDescription>
          </Alert>
        ) : null}

        {filteredRows.length === 0 && !fetchError ? (
          <AdminEmptyState
            title={
              pendingApprovals.length === 0 ? "No matching registrations" : "No pending requests"
            }
            description={
              showSaleroomCheckIn
                ? "No pending requests — use check-in above for walk-ins."
                : "Buyers who request to bid on this sale will appear here for approval."
            }
          />
        ) : null}

        {filteredRows.length > 0 ? (
          <section className="space-y-3">
            {filteredRows.map((row) => (
              <RegistrationRow
                key={row.id}
                saleId={saleId}
                row={row}
                showPaddleCheckIn={showSaleroomCheckIn}
              />
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}
