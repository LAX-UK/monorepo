"use client";

import { ConfirmFormSubmit } from "@/components/admin/confirm-form-submit";
import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import { ClerkLiveActionBar } from "@/features/saleroom/components/clerk-console/clerk-live-action-bar";
import { ClerkSessionBar } from "@/features/saleroom/components/clerk-console/clerk-session-bar";
import {
  CollapsibleConsoleSection,
  ConsoleSectionLabel,
} from "@/features/saleroom/components/clerk-console/console-panel";
import { DisplayControlPanel } from "@/features/saleroom/components/clerk-console/display-control-panel";
import { LotOnBlockPanel } from "@/features/saleroom/components/clerk-console/lot-on-block-panel";
import { LotRunwayPanel } from "@/features/saleroom/components/clerk-console/lot-runway-panel";
import { SaleroomActivityLog } from "@/features/saleroom/components/clerk-console/saleroom-activity-log";
import { TelephoneLinesPanel } from "@/features/saleroom/components/clerk-console/telephone-lines-panel";
import { SaleroomLiveShell } from "@/features/saleroom/components/saleroom-live-shell";
import { useClerkLotRosterSync } from "@/features/saleroom/hooks/use-clerk-lot-roster-sync";
import { useClerkPaddleRoster } from "@/features/saleroom/hooks/use-clerk-paddle-roster";
import { useLotRunway } from "@/features/saleroom/hooks/use-lot-runway";
import { deriveClerkLivePhase } from "@/features/saleroom/lib/clerk-live-phase";
import { useClerkLotLiveBidState } from "@/hooks/use-clerk-lot-live-price";
import {
  adminSaleroomCloseAction,
  adminSaleroomGoLiveAction,
  adminSaleroomPauseAction,
  adminSaleroomResumeAction,
} from "@/lib/actions/admin";
import type {
  AdminPaddleRosterEntry,
  AdminSaleroomSessionSnapshot,
  AdminTelephoneBookingRow,
} from "@/lib/data/http/admin.server";
import { mapAdminSaleroomSnapshotToSessionStatus } from "@/lib/saleroom/map-admin-saleroom-snapshot";
import { sortLotsForRunList } from "@/lib/saleroom/sort-lots-for-run-list";
import type { Lot, SaleDeliveryMode, SaleroomDisplayOverlay } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { cn } from "@auction/ui/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
  const [secondaryTab, setSecondaryTab] = useState<"telephone" | "activity">("telephone");
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [telephonePanelOpen, setTelephonePanelOpen] = useState(false);
  const syncedLots = useClerkLotRosterSync({ initialLots, liveFeed });
  const { roster: paddleRoster, refreshRoster } = useClerkPaddleRoster({
    saleId,
    initialRoster: initialPaddleRoster,
  });

  useEffect(() => {
    if (!checkedInRefresh) return;
    void refreshRoster().finally(() => {
      router.replace(`/admin/saleroom/${saleId}`, { scroll: false });
    });
  }, [checkedInRefresh, refreshRoster, router, saleId]);

  const sessionStatus = session.status;
  const currentLotId = session.currentLotId;
  const { progress, nextLot } = useLotRunway({
    lots: syncedLots,
    currentLotId,
    sessionStatus,
  });

  const orderedLots = useMemo(() => sortLotsForRunList(syncedLots), [syncedLots]);
  const currentLot = orderedLots.find((lot) => lot.id === currentLotId) ?? null;

  const liveBid = useClerkLotLiveBidState(
    currentLotId,
    currentLot?.currentPrice ?? "0.00",
    paddleRoster,
  );

  const selfServiceConflict = paddleRoster.some((p) => p.hasActiveSelfServiceSession);
  const pendingTelForLot =
    currentLotId != null
      ? telephoneBookings.filter(
          (b) =>
            b.status === "requested" && (b.lotIds.length === 0 || b.lotIds.includes(currentLotId)),
        ).length
      : 0;

  const canGoLive =
    sessionStatus === "none" || sessionStatus === "ended" || sessionStatus === "pending";
  const canPause = sessionStatus === "live";
  const canResume = sessionStatus === "paused";
  const canClose = sessionStatus === "live" || sessionStatus === "paused";
  const canHammer = sessionStatus === "live" && currentLotId != null;

  const alerts: Array<{
    key: string;
    title: string;
    body: import("react").ReactNode;
    variant: "default" | "destructive";
  }> = [];

  if (paddleRosterEmpty && registrationsHref) {
    alerts.push({
      key: "paddles",
      title: "Check in bidders before going live",
      body: (
        <>
          No paddles assigned yet.{" "}
          <Link href={registrationsHref} className="font-medium text-link underline">
            Check in bidders
          </Link>{" "}
          so clerks can place in-room bids.
        </>
      ),
      variant: "default",
    });
  }
  if (saleStatus && saleStatus !== "active") {
    alerts.push({
      key: "sale",
      title: "Sale not live yet",
      body: "Saleroom session controls work best when the sale status is active.",
      variant: "default",
    });
  }
  if (pendingTelForLot > 0) {
    alerts.push({
      key: "tel",
      title: "Telephone requests for current lot",
      body: `${pendingTelForLot} telephone request${pendingTelForLot === 1 ? "" : "s"} may need confirmation before the lot opens.`,
      variant: "default",
    });
  }
  if (selfServiceConflict) {
    alerts.push({
      key: "conflict",
      title: "Online + paddle activity detected",
      body: "At least one checked-in paddle has recent self-service bidding — confirm bidders are not double-bidding.",
      variant: "default",
    });
  }
  if (error) {
    alerts.push({
      key: "error",
      title: "Could not load saleroom state",
      body: error,
      variant: "destructive",
    });
  }

  const visibleAlerts = showAllAlerts ? alerts : alerts.slice(0, 2);
  const hiddenAlertCount = Math.max(0, alerts.length - visibleAlerts.length);
  const sessionLive = sessionStatus === "live";
  const livePhase = deriveClerkLivePhase(sessionStatus, progress, currentLotId);
  const isLiveSession = sessionStatus === "live" || sessionStatus === "paused";
  const sessionBarVariant = livePhase === "selling" ? "compact" : "full";
  const showActionBar = sessionLive && (canHammer || nextLot != null);
  const autoOpenTelephone = isLiveSession && pendingTelForLot > 0;

  useEffect(() => {
    if (autoOpenTelephone) {
      setTelephonePanelOpen(true);
    }
  }, [autoOpenTelephone]);

  const sessionControls = (
    <div className="flex flex-wrap items-center gap-2" aria-label="Saleroom session controls">
      {livePhase === "setup" ? (
        <div className="flex flex-wrap gap-2">
          <form id={`saleroom-go-live-${saleId}`} action={adminSaleroomGoLiveAction}>
            <input type="hidden" name="saleId" value={saleId} />
            <SaleroomPendingSubmit
              formId={`saleroom-go-live-${saleId}`}
              pendingLabel="Going live…"
              variant="default"
              className="min-h-11"
              disabled={!canGoLive}
              aria-disabled={!canGoLive}
            >
              Go live
            </SaleroomPendingSubmit>
          </form>
          <form id={`saleroom-resume-${saleId}`} action={adminSaleroomResumeAction}>
            <input type="hidden" name="saleId" value={saleId} />
            <SaleroomPendingSubmit
              formId={`saleroom-resume-${saleId}`}
              pendingLabel="Resuming…"
              variant="default"
              className="min-h-11"
              disabled={!canResume}
              aria-disabled={!canResume}
            >
              Resume
            </SaleroomPendingSubmit>
          </form>
        </div>
      ) : null}
      {livePhase === "paused" ? (
        <form id={`saleroom-resume-${saleId}`} action={adminSaleroomResumeAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <SaleroomPendingSubmit
            formId={`saleroom-resume-${saleId}`}
            pendingLabel="Resuming…"
            variant="default"
            className="min-h-11"
            disabled={!canResume}
            aria-disabled={!canResume}
          >
            Resume
          </SaleroomPendingSubmit>
        </form>
      ) : null}
      {livePhase === "betweenLots" || livePhase === "selling" ? (
        <form id={`saleroom-pause-${saleId}`} action={adminSaleroomPauseAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <SaleroomPendingSubmit
            formId={`saleroom-pause-${saleId}`}
            pendingLabel="Pausing…"
            variant="secondary"
            className="min-h-11"
            disabled={!canPause}
            aria-disabled={!canPause}
          >
            Pause
          </SaleroomPendingSubmit>
        </form>
      ) : null}
      {livePhase !== "setup" ? (
        <form id={`saleroom-close-${saleId}`} action={adminSaleroomCloseAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <ConfirmFormSubmit
            formId={`saleroom-close-${saleId}`}
            variant="secondary"
            confirmTitle="Close saleroom session?"
            confirmBody="Bidders will no longer see live updates until you go live again."
            confirmLabel="Close session"
            tone="warning"
            className="min-h-11"
            disabled={!canClose}
            aria-disabled={!canClose}
          >
            Close session
          </ConfirmFormSubmit>
        </form>
      ) : null}
    </div>
  );

  const displayPanel = (
    <DisplayControlPanel saleId={saleId} initialOverlay={initialDisplayOverlay} />
  );
  const telephonePanel = (
    <TelephoneLinesPanel saleId={saleId} currentLotId={currentLotId} rows={telephoneBookings} />
  );
  const activityPanel = <SaleroomActivityLog entries={activityLog} />;

  return (
    <div className={cn("space-y-6", showActionBar && "pb-24")}>
      {visibleAlerts.map((alert) => (
        <Alert key={alert.key} variant={alert.variant}>
          <AlertTitle>{alert.title}</AlertTitle>
          <AlertDescription>{alert.body}</AlertDescription>
        </Alert>
      ))}
      {hiddenAlertCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-0 font-body text-sm text-secondary"
          onClick={() => setShowAllAlerts(true)}
        >
          +{hiddenAlertCount} more alert{hiddenAlertCount === 1 ? "" : "s"}
        </Button>
      ) : null}

      <ClerkSessionBar
        saleTitle={saleTitle}
        {...(deliveryMode ? { deliveryMode } : {})}
        session={session}
        currentLot={currentLot}
        progress={progress}
        leaderLabel={liveBid.leaderLabel}
        leaderAmount={liveBid.leaderAmount}
        variant={sessionBarVariant}
      />

      <div className="space-y-3">
        <ConsoleSectionLabel>Session</ConsoleSectionLabel>
        {sessionControls}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LotRunwayPanel
          saleId={saleId}
          lots={orderedLots}
          currentLotId={currentLotId}
          sessionLive={sessionLive}
          sessionStatus={sessionStatus}
        />
        <LotOnBlockPanel
          saleId={saleId}
          currentLotId={currentLotId}
          lots={orderedLots}
          telephoneBookings={telephoneBookings}
          paddleRoster={paddleRoster}
          liveBid={liveBid}
          canHammer={canHammer}
          showOutcomeControls={livePhase === "selling"}
          nextLot={nextLot}
          sessionLive={sessionLive}
          betweenLots={progress.betweenLots}
          progressLabel={progress.progressLabel}
        />
      </div>

      {isLiveSession ? (
        <div className="space-y-3">
          <CollapsibleConsoleSection title="Venue display" defaultOpen={false}>
            {displayPanel}
          </CollapsibleConsoleSection>
          <CollapsibleConsoleSection
            title="Telephone lines"
            open={telephonePanelOpen || autoOpenTelephone}
            onOpenChange={setTelephonePanelOpen}
          >
            {telephonePanel}
          </CollapsibleConsoleSection>
          <CollapsibleConsoleSection title="Activity log" defaultOpen={false}>
            {activityPanel}
          </CollapsibleConsoleSection>
        </div>
      ) : (
        <>
          {displayPanel}

          <div className="hidden lg:block">{telephonePanel}</div>

          <div className="space-y-3 lg:hidden">
            <div className="flex gap-2" role="tablist" aria-label="Secondary panels">
              <button
                type="button"
                role="tab"
                aria-selected={secondaryTab === "telephone"}
                className={`min-h-11 rounded-md px-3 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] ${
                  secondaryTab === "telephone"
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-high text-secondary"
                }`}
                onClick={() => setSecondaryTab("telephone")}
              >
                Telephone
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={secondaryTab === "activity"}
                className={`min-h-11 rounded-md px-3 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] ${
                  secondaryTab === "activity"
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-high text-secondary"
                }`}
                onClick={() => setSecondaryTab("activity")}
              >
                Activity
              </button>
            </div>
            {secondaryTab === "telephone" ? telephonePanel : activityPanel}
          </div>

          <div className="hidden lg:block">{activityPanel}</div>
        </>
      )}

      <ClerkLiveActionBar
        saleId={saleId}
        canHammer={canHammer}
        sessionLive={sessionLive}
        nextLot={nextLot}
      />
    </div>
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
