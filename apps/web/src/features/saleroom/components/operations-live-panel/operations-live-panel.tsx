"use client";

import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import { SaleroomLiveShell } from "@/features/saleroom/components/saleroom-live-shell";
import { ConnectionStatusChip } from "@/features/saleroom/components/shared/connection-status-chip";
import { SaleDeliveryModeBadge } from "@/features/saleroom/components/shared/sale-delivery-mode-badge";
import { mergeOperationsSnapshot } from "@/features/saleroom/lib/merge-operations-snapshot";
import { operationsSnapshotToSessionStatus } from "@/features/saleroom/lib/merge-operations-snapshot";
import type { StaffOpsPanelVM } from "@/features/saleroom/types/staff-saleroom.vm";
import { useClerkLotLiveBidState } from "@/hooks/use-clerk-lot-live-price";
import type { AdminSaleOperationsSnapshot } from "@/lib/telephone/telephone-booking-types";
import { formatDateTime, formatMoney } from "@/lib/ui/format";
import type { Lot, Sale } from "@auction/types";
import { LiveBadge } from "@auction/ui/components/live-badge";
import Link from "next/link";
import { useMemo } from "react";

type Props = {
  saleId: string;
  sale: Sale;
  liveish: boolean;
  snapshot: AdminSaleOperationsSnapshot;
  checkedInPaddleCount?: number;
  lots?: Lot[];
};

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-4 transition-colors duration-200">
      <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        {label}
      </p>
      <p className="mt-2 font-headline text-xl capitalize text-on-surface">{value}</p>
    </div>
  );
}

function ActionCard({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-border-hairline bg-surface-container-low/40 p-5 transition-colors duration-200 hover:border-link/30 hover:bg-primary/5"
    >
      <h3 className="font-headline text-base text-on-surface">{title}</h3>
      <p className="mt-2 font-body text-sm text-on-surface-variant">{description}</p>
      <span className="mt-3 inline-block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        {cta}
      </span>
    </Link>
  );
}

function OperationsLiveContent({
  saleId,
  sale,
  liveish,
  snapshot,
  checkedInPaddleCount = 0,
  lots = [],
  session,
}: Props & {
  session: ReturnType<
    typeof import("@/features/saleroom/hooks/use-staff-saleroom-live").useStaffSaleroomLive
  >["session"];
}) {
  const liveBid = useClerkLotLiveBidState(
    session.currentLotId,
    snapshot.currentLotBidding?.currentPrice ?? "0.00",
    [],
  );

  const vm: StaffOpsPanelVM = useMemo(
    () =>
      mergeOperationsSnapshot(
        snapshot,
        {
          status: session.status,
          currentLotId: session.currentLotId,
          connectionStatus: session.connectionStatus,
          lastEventAt: session.lastEventAt,
        },
        {
          currentPrice: liveBid.currentPrice,
          bidCount: liveBid.bidCount,
          leaderLabel: liveBid.leaderLabel,
        },
        checkedInPaddleCount,
        lots,
      ),
    [checkedInPaddleCount, liveBid, lots, session, snapshot],
  );

  const primaryCta =
    vm.sessionStatus === "live" || vm.sessionStatus === "paused"
      ? {
          title: "Open saleroom console",
          description: "Advance lots, hammer, and manage live telephone lines.",
          href: `/admin/saleroom/${saleId}`,
          cta: "Open console →",
        }
      : {
          title: "Go live in clerk console",
          description: "Start the saleroom session when the sale floor is ready.",
          href: `/admin/saleroom/${saleId}`,
          cta: "Go live →",
        };

  return (
    <div className="space-y-6">
      {!liveish ? (
        <p className="font-body text-sm text-on-surface-variant">
          Operations tooling activates when this sale is scheduled or live. Current status:{" "}
          <strong className="capitalize">{sale.status}</strong>.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <SaleDeliveryModeBadge mode={vm.deliveryMode} />
        {session.isSessionLive ? <LiveBadge /> : null}
        <ConnectionStatusChip status={vm.connectionStatus} lastEventAt={vm.lastEventAt} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Saleroom" value={vm.sessionStatus} />
        <MetricCard label="Pending registrations" value={String(vm.pendingRegistrations)} />
        <MetricCard label="Telephone requested" value={String(vm.pendingTelephone)} />
        <MetricCard label="Checked-in paddles" value={String(vm.checkedInPaddleCount)} />
      </div>

      {vm.currentLotId != null ? (
        <div
          className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-5 transition-all duration-200"
          aria-live="polite"
        >
          <h3 className="font-headline text-base text-on-surface">On the block</h3>
          <p className="mt-2 font-body text-sm text-on-surface-variant">
            Lot {vm.currentLotNumber ?? "—"} ·{" "}
            {vm.currentLotTitle ?? `Lot ${vm.currentLotId.slice(0, 8)}…`}
          </p>
          {vm.currentPrice ? (
            <p className="mt-1 font-headline text-xl tabular-nums text-on-surface">
              {formatMoney(vm.currentPrice)}
              {vm.bidCount != null ? (
                <span className="ml-2 font-body text-sm text-on-surface-variant">
                  · {vm.bidCount} bid{vm.bidCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </p>
          ) : null}
          {vm.leaderLabel ? (
            <p className="mt-1 font-body text-sm text-on-surface">
              Leading: <span className="font-medium">{vm.leaderLabel}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <ActionCard {...primaryCta} />
        <ActionCard
          title="Check in bidder"
          description="Assign paddles for walk-in clients at the saleroom desk."
          href={`${saleDetailTabHref(saleId, "registrations")}#check-in`}
          cta="Check in →"
        />
        <ActionCard
          title="Telephone bookings"
          description={`${vm.pendingTelephone} awaiting confirmation.`}
          href={saleDetailTabHref(saleId, "telephone-bookings")}
          cta="Manage lines →"
        />
      </div>

      {vm.pendingTelephoneRows.length > 0 ? (
        <details className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-5">
          <summary className="cursor-pointer font-headline text-base text-on-surface">
            Pending telephone requests ({vm.pendingTelephoneRows.length})
          </summary>
          <ul className="mt-3 space-y-2 font-body text-sm">
            {vm.pendingTelephoneRows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{row.userName ?? row.userEmail ?? row.userId}</span>
                <span className="text-on-surface-variant">{row.phoneDisplay ?? row.phoneE164}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {sale.startTime ? (
        <p className="font-body text-xs text-on-surface-variant">
          Sale starts {formatDateTime(sale.startTime)}
        </p>
      ) : null}
    </div>
  );
}

export function OperationsLivePanel(props: Props) {
  const initial = useMemo(
    () => operationsSnapshotToSessionStatus(props.snapshot),
    [props.snapshot],
  );

  return (
    <SaleroomLiveShell saleId={props.saleId} initial={initial} trackLiveFeed={false}>
      {({ session }) => <OperationsLiveContent {...props} session={session} />}
    </SaleroomLiveShell>
  );
}
