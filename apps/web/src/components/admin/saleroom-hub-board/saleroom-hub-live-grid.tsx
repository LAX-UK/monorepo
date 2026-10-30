"use client";

import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import { ConnectionStatusChip } from "@/features/saleroom/components/shared/connection-status-chip";
import { useSaleroomHubLive } from "@/features/saleroom/hooks/use-saleroom-hub-live";
import type { SaleroomHubLiveSession } from "@/features/saleroom/hooks/use-saleroom-hub-live";
import { useSaleroomHubMetricsPoll } from "@/features/saleroom/hooks/use-saleroom-hub-metrics-poll";
import { staffSaleroomRoomStatus } from "@/lib/admin/staff-kit-status";
import type { SaleroomHubRowSummary } from "@/lib/data/view-models/admin-saleroom-hub.vm";
import { deliveryModeShortLabel } from "@/lib/presenters/delivery-mode/delivery-mode-registry";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { isSaleroomSessionLive } from "@/lib/saleroom/public-session-status";
import type { AdminSaleOperationsSnapshot } from "@/lib/telephone/telephone-booking-types";
import { ProgressBar, StaffButton, StatusBadge, TextLink } from "@auction/staff-ui";
import { TriangleAlert } from "lucide-react";
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

  const pendingReg = snapshot?.registrations.pending ?? 0;
  const pendingTel = snapshot?.telephoneBookings.requested ?? 0;
  const needsAttention = pendingReg > 0 || pendingTel > 0;
  const status = staffSaleroomRoomStatus(session.status, { saleEnded: row.saleStatus === "ended" });
  const betweenLots = session.status === "live" && !session.currentLotId;

  const completedLabel = `${completedLots} of ${row.totalLots} complete`;
  let progressLabel: string;
  let showCompleted = row.totalLots > 0;
  if (session.currentLotId && enriched.currentLotNumber != null && row.totalLots > 0) {
    progressLabel = `Lot ${enriched.currentLotNumber} of ${row.totalLots}`;
  } else if (betweenLots) {
    progressLabel = "Between lots";
  } else if (row.totalLots > 0) {
    progressLabel = `${row.totalLots} ${row.totalLots === 1 ? "lot" : "lots"}`;
  } else {
    progressLabel = "No lots";
    showCompleted = false;
  }
  const roomOpen = session.status === "live" || session.status === "paused";

  const waiting = [
    pendingReg > 0 ? `${pendingReg} ${pendingReg === 1 ? "registration" : "registrations"}` : null,
    pendingTel > 0 ? `${pendingTel} telephone ${pendingTel === 1 ? "request" : "requests"}` : null,
  ]
    .filter(Boolean)
    .join(" and ");

  const titleId = `room-${row.saleId}`;
  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-staff-lg border border-staff-line bg-staff-surface p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={titleId} className="text-staff-md font-semibold text-staff-fg">
            <Link
              href={`/admin/saleroom/${row.saleId}`}
              className="staff-focus rounded-staff-xs hover:underline"
            >
              {row.title}
            </Link>
          </h3>
          <p className="text-staff-sm text-staff-muted">
            {deliveryModeShortLabel(row.deliveryMode)} sale
          </p>
        </div>
        <StatusBadge tone={status.tone} live={status.live ?? false}>
          {status.label}
        </StatusBadge>
      </div>

      {enriched.currentLotTitle ? (
        <p className="text-staff-sm text-staff-fg">
          <span className="text-staff-muted">On the block </span>
          {enriched.currentLotTitle}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3 text-staff-sm">
          <p className="text-staff-fg">{progressLabel}</p>
          {showCompleted ? <p className="text-staff-muted tabular-nums">{completedLabel}</p> : null}
        </div>
        {row.totalLots > 0 ? (
          <ProgressBar value={completedLots} max={row.totalLots} label="Lots complete" />
        ) : null}
      </div>

      <ConnectionStatusChip
        status={session.connectionStatus}
        lastEventAt={session.lastEventAt}
        hideWhenConnected
      />

      {needsAttention ? (
        <p className="flex items-start gap-1.5 text-staff-sm font-medium text-staff-warning-fg">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {waiting} waiting for review
        </p>
      ) : null}

      {row.venueDayCounts ? (
        <p className="text-staff-sm text-staff-muted tabular-nums">
          {row.venueDayCounts.rsvped} RSVPs · {row.venueDayCounts.galaCheckedIn} arrived ·{" "}
          {row.venueDayCounts.paddled} with paddles ·{" "}
          <TextLink
            href={`/admin/event-rsvps/${encodeURIComponent(row.venueDayCounts.eventSlug)}`}
            Link={Link}
          >
            {row.venueDayCounts.eventTitle}
          </TextLink>
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <StaffButton asChild variant={roomOpen ? "primary" : "secondary"} size="lg">
          <Link href={`/admin/saleroom/${row.saleId}`}>Open console</Link>
        </StaffButton>
        <StaffButton asChild variant="secondary" size="lg">
          <Link href={`${saleDetailTabHref(row.saleId, "registrations")}#check-in`}>
            Check in bidders
          </Link>
        </StaffButton>
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
    <section aria-labelledby="live-rooms-title" className="flex flex-col gap-3">
      <h2 id="live-rooms-title" className="text-staff-md font-semibold text-staff-fg">
        Rooms to run
      </h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
    </section>
  );
}
