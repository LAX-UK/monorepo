"use client";

import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import { SaleroomLiveShell } from "@/features/saleroom/components/saleroom-live-shell";
import { useOperationsMetricsPoll } from "@/features/saleroom/hooks/use-operations-metrics-poll";
import { mergeOperationsSnapshot } from "@/features/saleroom/lib/merge-operations-snapshot";
import { operationsSnapshotToSessionStatus } from "@/features/saleroom/lib/merge-operations-snapshot";
import type { StaffOpsPanelVM } from "@/features/saleroom/types/staff-saleroom.vm";
import { useClerkLotLiveBidState } from "@/hooks/use-clerk-lot-live-price";
import type { AdminPaddleRosterEntry } from "@/lib/data/http/admin.server";
import type { AdminSaleOperationsSnapshot } from "@/lib/telephone/telephone-booking-types";
import { formatMoney } from "@/lib/ui/format";
import { KeyValueList, Notice, StaffButton, StatGrid, StatusBadge } from "@auction/staff-ui";
import type { Lot, Sale } from "@auction/types";
import Link from "next/link";
import { useMemo } from "react";

type Props = {
  saleId: string;
  sale: Sale;
  liveish: boolean;
  snapshot: AdminSaleOperationsSnapshot;
  paddleRoster?: AdminPaddleRosterEntry[];
  lots?: Lot[];
};

const SESSION_LABEL: Record<string, string> = {
  live: "Live",
  paused: "Paused",
  ended: "Ended",
  not_started: "Not started",
  idle: "Not started",
};

const CONNECTION = {
  connected: { label: "Connected", tone: "success" },
  reconnecting: { label: "Reconnecting", tone: "warning" },
  disconnected: { label: "Disconnected", tone: "danger" },
} as const;

function OperationsLiveContent({
  saleId,
  liveish,
  snapshot,
  paddleRoster = [],
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
    paddleRoster,
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
        paddleRoster.length,
        lots,
      ),
    [liveBid, lots, paddleRoster.length, session, snapshot],
  );

  const connection = CONNECTION[vm.connectionStatus];
  const sessionLabel =
    SESSION_LABEL[vm.sessionStatus] ??
    vm.sessionStatus.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="flex flex-col gap-4">
      {!liveish ? (
        <Notice tone="info" title="Operations open once the sale is scheduled or live" />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={connection.tone}>{connection.label}</StatusBadge>
      </div>

      <StatGrid
        label="Saleroom numbers"
        items={[
          { id: "session", label: "Saleroom", value: sessionLabel },
          { id: "registrations", label: "Registrations waiting", value: vm.pendingRegistrations },
          { id: "telephone", label: "Telephone requests waiting", value: vm.pendingTelephone },
          { id: "paddles", label: "Paddles checked in", value: vm.checkedInPaddleCount },
        ]}
      />

      {vm.currentLotId != null ? (
        <div aria-live="polite" className="flex flex-col gap-2">
          <h3 className="text-staff-sm font-semibold text-staff-fg">On the block</h3>
          <KeyValueList
            items={[
              {
                label: "Lot",
                value: `${vm.currentLotNumber != null ? `${vm.currentLotNumber} · ` : ""}${vm.currentLotTitle ?? "Untitled lot"}`,
              },
              ...(vm.currentPrice
                ? [
                    {
                      label: "Current bid",
                      value: formatMoney(vm.currentPrice),
                      numeric: true,
                    },
                  ]
                : []),
              ...(vm.bidCount != null
                ? [{ label: "Bids", value: String(vm.bidCount), numeric: true }]
                : []),
              ...(vm.leaderLabel ? [{ label: "Leading", value: vm.leaderLabel }] : []),
            ]}
          />
        </div>
      ) : null}

      {vm.pendingTelephoneRows.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-staff-sm font-semibold text-staff-fg">Telephone requests waiting</h3>
          <KeyValueList
            items={vm.pendingTelephoneRows.map((row) => ({
              label: row.userName ?? row.userEmail ?? "Unnamed bidder",
              value: row.phoneDisplay ?? row.phoneE164,
            }))}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <StaffButton asChild variant="primary">
          <Link href={`/admin/saleroom/${saleId}`}>
            {vm.sessionStatus === "live" || vm.sessionStatus === "paused"
              ? "Open saleroom console"
              : "Go live in the clerk console"}
          </Link>
        </StaffButton>
        <StaffButton asChild variant="secondary">
          <Link href={`${saleDetailTabHref(saleId, "registrations")}#check-in`}>
            Check in a bidder
          </Link>
        </StaffButton>
        <StaffButton asChild variant="secondary">
          <Link href={saleDetailTabHref(saleId, "telephone-bookings")}>Manage telephone lines</Link>
        </StaffButton>
      </div>
    </div>
  );
}

export function OperationsLivePanel(props: Props) {
  const { snapshot, paddleRoster } = useOperationsMetricsPoll({
    saleId: props.saleId,
    initialSnapshot: props.snapshot,
    initialPaddleRoster: props.paddleRoster ?? [],
  });

  const initial = useMemo(() => operationsSnapshotToSessionStatus(snapshot), [snapshot]);

  return (
    <SaleroomLiveShell saleId={props.saleId} initial={initial} trackLiveFeed={false}>
      {({ session }) => (
        <OperationsLiveContent
          {...props}
          snapshot={snapshot}
          paddleRoster={paddleRoster}
          session={session}
        />
      )}
    </SaleroomLiveShell>
  );
}
