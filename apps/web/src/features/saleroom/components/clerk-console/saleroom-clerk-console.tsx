"use client";

import { ClerkConsoleAlertsPanel } from "@/features/saleroom/components/clerk-console/clerk-console-alerts-panel";
import { ClerkConsoleLayout } from "@/features/saleroom/components/clerk-console/clerk-console-layout";
import { ClerkLiveActionBar } from "@/features/saleroom/components/clerk-console/clerk-live-action-bar";
import { ClerkSecondaryToolsRail } from "@/features/saleroom/components/clerk-console/clerk-secondary-tools-rail";
import { ClerkSessionBar } from "@/features/saleroom/components/clerk-console/clerk-session-bar";
import { ClerkSessionToolbar } from "@/features/saleroom/components/clerk-console/clerk-session-toolbar";
import { DisplayControlPanel } from "@/features/saleroom/components/clerk-console/display-control-panel";
import { LotOnBlockPanel } from "@/features/saleroom/components/clerk-console/lot-on-block-panel";
import { LotRunwayPanel } from "@/features/saleroom/components/clerk-console/lot-runway-panel";
import { SaleroomActivityLog } from "@/features/saleroom/components/clerk-console/saleroom-activity-log";
import { TelephoneLinesPanel } from "@/features/saleroom/components/clerk-console/telephone-lines-panel";
import { SaleroomLiveShell } from "@/features/saleroom/components/saleroom-live-shell";
import { useClerkConsoleModel } from "@/features/saleroom/hooks/use-clerk-console-model";
import { useClerkLotRosterSync } from "@/features/saleroom/hooks/use-clerk-lot-roster-sync";
import { useClerkPaddleRoster } from "@/features/saleroom/hooks/use-clerk-paddle-roster";
import { useClerkLotLiveBidState } from "@/hooks/use-clerk-lot-live-price";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import type {
  AdminPaddleRosterEntry,
  AdminSaleroomSessionSnapshot,
  AdminTelephoneBookingRow,
} from "@/lib/data/http/admin.server";
import { mapAdminSaleroomSnapshotToSessionStatus } from "@/lib/saleroom/map-admin-saleroom-snapshot";
import { notify } from "@/lib/ui/notify";
import type { Lot, SaleDeliveryMode, SaleroomDisplayOverlay } from "@auction/types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

type Props = {
  saleId: string;
  saleTitle: string;
  deliveryMode?: SaleDeliveryMode;
  saleStatus?: string;
  initial: AdminSaleroomSessionSnapshot;
  lots: Lot[];
  telephoneBookings?: AdminTelephoneBookingRow[];
  paddleRoster?: AdminPaddleRosterEntry[];
  error?: string | null;
  actionError?: string | null;
  loadWarnings?: string[];
  registrationsHref?: string;
  paddleRosterEmpty?: boolean;
  checkedInRefresh?: boolean;
};

function ClerkConsoleInner({
  saleId,
  saleTitle,
  deliveryMode,
  saleStatus,
  lots: initialLots,
  telephoneBookings = [],
  paddleRoster: initialPaddleRoster = [],
  error,
  actionError,
  loadWarnings = [],
  registrationsHref,
  paddleRosterEmpty = false,
  checkedInRefresh = false,
  initialDisplayOverlay = null,
  session,
  activityLog,
  liveFeed,
}: Omit<Props, "initial"> & {
  session: ReturnType<
    typeof import("@/features/saleroom/hooks/use-staff-saleroom-live").useStaffSaleroomLive
  >["session"];
  activityLog: ReturnType<
    typeof import("@/features/saleroom/hooks/use-staff-saleroom-live").useStaffSaleroomLive
  >["activityLog"];
  liveFeed: ReturnType<
    typeof import("@/features/saleroom/hooks/use-staff-saleroom-live").useStaffSaleroomLive
  >["liveFeed"];
  initialDisplayOverlay?: SaleroomDisplayOverlay | null;
}) {
  const router = useRouter();
  const syncedLots = useClerkLotRosterSync({ initialLots, liveFeed });
  const { roster: paddleRoster, refreshRoster } = useClerkPaddleRoster({
    saleId,
    initialRoster: initialPaddleRoster,
    pollIntervalMs: 45_000,
  });

  useEffect(() => {
    if (!checkedInRefresh) return;
    void refreshRoster().finally(() => {
      router.replace(`/admin/saleroom/${saleId}`, { scroll: false });
    });
  }, [checkedInRefresh, refreshRoster, router, saleId]);

  useEffect(() => {
    if (!actionError) return;
    const message = safeDecodeAdminErrorParam(actionError);
    if (message) notify.error(message);
    router.replace(`/admin/saleroom/${saleId}`, { scroll: false });
  }, [actionError, router, saleId]);

  const currentLotId = session.currentLotId;
  const currentLotForBid = syncedLots.find((lot) => lot.id === currentLotId) ?? null;

  const liveBid = useClerkLotLiveBidState(
    currentLotId,
    currentLotForBid?.currentPrice ?? "0.00",
    paddleRoster,
  );

  const model = useClerkConsoleModel({
    saleId,
    saleTitle,
    ...(deliveryMode ? { deliveryMode } : {}),
    ...(saleStatus ? { saleStatus } : {}),
    lots: syncedLots,
    telephoneBookings,
    paddleRoster,
    paddleRosterEmpty,
    ...(registrationsHref ? { registrationsHref } : {}),
    loadWarnings,
    ...(error != null ? { error } : {}),
    session,
    activityLog,
    liveBid,
  });

  const panelVariant = model.phaseLayout.toolsPresentation === "tabbed" ? "plain" : "bordered";

  return (
    <ClerkConsoleLayout
      phaseLayout={model.phaseLayout}
      showActionBar={model.showActionBar}
      slots={{
        alerts: (
          <ClerkConsoleAlertsPanel
            alerts={model.feedback.alerts}
            {...(model.feedback.registrationsHref
              ? { registrationsHref: model.feedback.registrationsHref }
              : {})}
          />
        ),
        sessionBar: (
          <ClerkSessionBar
            saleTitle={saleTitle}
            {...(deliveryMode ? { deliveryMode } : {})}
            session={model.session.session}
            currentLot={model.lot.currentLot}
            progress={model.lot.progress}
            leaderLabel={model.lot.liveBid.leaderLabel}
            leaderAmount={model.lot.liveBid.leaderAmount}
            mode={model.phaseLayout.sessionBarMode}
          />
        ),
        sessionToolbar: (
          <ClerkSessionToolbar
            saleId={saleId}
            livePhase={model.session.livePhase}
            sessionStatus={model.action.sessionStatus}
            sticky={model.phaseLayout.stickySessionToolbar}
          />
        ),
        runway: (
          <LotRunwayPanel
            saleId={saleId}
            lots={model.lot.lots}
            currentLotId={model.lot.currentLotId}
            sessionLive={model.action.sessionLive}
            sessionStatus={model.action.sessionStatus}
            policy={model.action.policy}
            betweenLots={model.lot.progress.betweenLots}
            nextLot={model.lot.nextLot}
          />
        ),
        onBlock: (
          <LotOnBlockPanel
            saleId={saleId}
            currentLotId={model.lot.currentLotId}
            lots={model.lot.lots}
            telephoneBookings={model.roster.telephoneBookings}
            paddleRoster={model.roster.paddleRoster}
            liveBid={model.lot.liveBid}
            nextLot={model.lot.nextLot}
            sessionLive={model.action.sessionLive}
            betweenLots={model.lot.progress.betweenLots}
            progressLabel={model.lot.progress.progressLabel}
          />
        ),
        tools: (
          <ClerkSecondaryToolsRail
            phase={model.session.livePhase}
            phaseLayout={model.phaseLayout}
            pendingTelForLot={model.pendingTelForLot}
            slots={{
              display: (
                <DisplayControlPanel
                  saleId={saleId}
                  initialOverlay={initialDisplayOverlay}
                  panelVariant={panelVariant}
                />
              ),
              telephone: (
                <TelephoneLinesPanel
                  saleId={saleId}
                  currentLotId={model.lot.currentLotId}
                  rows={model.roster.telephoneBookings}
                  panelVariant={panelVariant}
                />
              ),
              activity: (
                <SaleroomActivityLog
                  entries={model.session.activityLog}
                  panelVariant={panelVariant}
                />
              ),
            }}
          />
        ),
        liveDock: (
          <ClerkLiveActionBar
            saleId={saleId}
            canHammer={model.action.canHammer}
            sessionLive={model.action.sessionLive}
            nextLot={model.lot.nextLot}
            policy={model.action.policy}
          />
        ),
      }}
    />
  );
}

export function SaleroomClerkConsole(props: Props) {
  const initialSession = useMemo(
    () => mapAdminSaleroomSnapshotToSessionStatus(props.initial),
    [props.initial],
  );
  const initialDisplayOverlay = props.initial.session?.displayOverlay ?? null;

  return (
    <SaleroomLiveShell
      saleId={props.saleId}
      initial={initialSession}
      dbEvents={props.initial.events}
      trackLiveFeed
    >
      {({ session, activityLog, liveFeed }) => (
        <ClerkConsoleInner
          {...props}
          initialDisplayOverlay={initialDisplayOverlay}
          session={session}
          activityLog={activityLog}
          liveFeed={liveFeed}
        />
      )}
    </SaleroomLiveShell>
  );
}
