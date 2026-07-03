"use client";

import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import { ConnectionStatusChip } from "@/features/saleroom/components/shared/connection-status-chip";
import { SaleDeliveryModeBadge } from "@/features/saleroom/components/shared/sale-delivery-mode-badge";
import { useSaleroomHubLive } from "@/features/saleroom/hooks/use-saleroom-hub-live";
import type { SaleroomHubLiveSession } from "@/features/saleroom/hooks/use-saleroom-hub-live";
import { useSaleroomHubMetricsPoll } from "@/features/saleroom/hooks/use-saleroom-hub-metrics-poll";
import type { SaleroomHubRowSummary } from "@/lib/data/view-models/admin-saleroom-hub.vm";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { isSaleroomSessionLive } from "@/lib/saleroom/public-session-status";
import type { AdminSaleOperationsSnapshot } from "@/lib/telephone/telephone-booking-types";
import { Button } from "@auction/ui";
import { LiveBadge } from "@auction/ui/components/live-badge";
import Link from "next/link";

type Props = {
  rows: SaleroomHubRowSummary[];
  initialSessions: Record<string, PublicSaleroomSessionStatus>;
};

function sortHubRows(
  rows: SaleroomHubRowSummary[],
  sessions: Record<string, SaleroomHubLiveSession>,
  snapshots: Record<string, AdminSaleOperationsSnapshot | null>,
): SaleroomHubRowSummary[] {
  const score = (row: SaleroomHubRowSummary): number => {
    const session = sessions[row.saleId];
    const snap = snapshots[row.saleId];
    const pending = (snap?.registrations.pending ?? 0) + (snap?.telephoneBookings.requested ?? 0);
    const needsClosing =
      isSaleroomSessionLive(session?.status ?? "none") && row.saleStatus === "ended";
    if (session?.status === "live" && !needsClosing) return 1000 + pending;
    if (session?.status === "paused" && !needsClosing) return 900 + pending;
    if (needsClosing) return 850 + pending;
    if (pending > 0) return 800 + pending;
    if (row.saleStatus === "active") return 100;
    return 0;
  };
  return [...rows].sort((a, b) => score(b) - score(a));
}

function RoomCard({
  row,
  session,
  snapshot,
  completedLots,
}: {
  row: SaleroomHubRowSummary;
  session: SaleroomHubLiveSession;
  snapshot: AdminSaleOperationsSnapshot | null;
  completedLots: number;
}) {
  const saleroom = snapshot?.saleroomSession;
  const enriched = {
    ...row,
    currentLotNumber: row.currentLotNumber ?? saleroom?.currentLotNumber ?? null,
    currentLotTitle: row.currentLotTitle ?? saleroom?.currentLotTitle ?? null,
  };

  const progressPercent = row.totalLots > 0 ? Math.round((completedLots / row.totalLots) * 100) : 0;

  const pendingReg = snapshot?.registrations.pending ?? 0;
  const pendingTel = snapshot?.telephoneBookings.requested ?? 0;
  const needsAttention = pendingReg > 0 || pendingTel > 0;
  const needsClosing = isSaleroomSessionLive(session.status) && row.saleStatus === "ended";

  let progressLabel: string;
  if (session.currentLotId && enriched.currentLotNumber != null && row.totalLots > 0) {
    progressLabel = `Lot ${enriched.currentLotNumber} of ${row.totalLots}`;
  } else if (session.status === "live" && !session.currentLotId) {
    progressLabel = "Between lots";
  } else if (row.totalLots > 0) {
    progressLabel = `${completedLots} of ${row.totalLots} complete`;
  } else {
    progressLabel = "No lots";
  }

  return (
    <article
      className={`flex flex-col rounded-xl border border-border-hairline bg-surface-container-low/40 p-4 transition-colors duration-200 ${
        needsAttention ? "ring-1 ring-error/30" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {needsAttention ? (
              <span
                className="size-2 shrink-0 rounded-full bg-error"
                aria-label="Needs attention"
              />
            ) : null}
            <Link
              href={`/admin/saleroom/${row.saleId}`}
              className="font-headline text-base text-link hover:underline"
            >
              {row.title}
            </Link>
            <SaleDeliveryModeBadge mode={row.deliveryMode} />
            {needsClosing ? (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Needs closing
              </span>
            ) : isSaleroomSessionLive(session.status) ? (
              <LiveBadge />
            ) : null}
            {session.status === "paused" ? (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Paused
              </span>
            ) : session.status === "live" && !session.currentLotId ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Between lots
              </span>
            ) : null}
          </div>
          {enriched.currentLotTitle ? (
            <p className="font-body text-sm text-on-surface-variant">
              On block: {enriched.currentLotTitle}
            </p>
          ) : session.status === "live" && !session.currentLotId ? (
            <p className="font-body text-sm text-on-surface-variant">Between lots</p>
          ) : null}
        </div>
        <ConnectionStatusChip
          status={session.connectionStatus}
          lastEventAt={session.lastEventAt}
          hideWhenConnected
        />
      </div>

      <div className="mt-3 space-y-1">
        <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          {progressLabel}
        </p>
        {row.totalLots > 0 ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-surface-container-high" aria-hidden="true">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="font-body text-xs tabular-nums text-secondary">
              {completedLots}/{row.totalLots}
            </span>
          </div>
        ) : null}
      </div>

      {(pendingReg > 0 || pendingTel > 0) && (
        <p className="mt-2 font-body text-xs text-on-surface-variant">
          {pendingReg > 0 ? `${pendingReg} reg pending` : null}
          {pendingReg > 0 && pendingTel > 0 ? " · " : null}
          {pendingTel > 0 ? `${pendingTel} tel pending` : null}
        </p>
      )}

      {row.venueDayCounts ? (
        <p className="mt-2 font-body text-xs text-on-surface-variant">
          RSVP&apos;d {row.venueDayCounts.rsvped} · Gala in {row.venueDayCounts.galaCheckedIn} ·
          Paddled {row.venueDayCounts.paddled}
          {" · "}
          <Link
            href={`/admin/event-rsvps/${encodeURIComponent(row.venueDayCounts.eventSlug)}`}
            className="text-link underline"
          >
            {row.venueDayCounts.eventTitle}
          </Link>
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" className="min-h-11" asChild>
          <Link href={`/admin/saleroom/${row.saleId}`}>Open console</Link>
        </Button>
        <Button variant="outline" size="sm" className="min-h-11" asChild>
          <Link href={`${saleDetailTabHref(row.saleId, "registrations")}#check-in`}>Check-in</Link>
        </Button>
      </div>
    </article>
  );
}

export function SaleroomHubLiveGrid({ rows, initialSessions }: Props) {
  const saleIds = rows.map((r) => r.saleId);
  const { sessions, completedBumps } = useSaleroomHubLive({
    saleIds,
    initialBySaleId: initialSessions,
  });
  const { snapshots } = useSaleroomHubMetricsPoll(saleIds, rows);

  const sorted = sortHubRows(rows, sessions, snapshots);

  if (sorted.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="font-headline text-lg text-on-surface">Live rooms</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((row) => {
          const session = sessions[row.saleId] ?? {
            status: "none" as const,
            currentLotId: null,
            connectionStatus: "disconnected" as const,
            lastEventAt: null,
          };
          const snapshot = snapshots[row.saleId] ?? null;
          const completedLots = row.completedLots + (completedBumps[row.saleId] ?? 0);
          return (
            <RoomCard
              key={row.saleId}
              row={row}
              session={session}
              snapshot={snapshot}
              completedLots={completedLots}
            />
          );
        })}
      </div>
    </div>
  );
}
