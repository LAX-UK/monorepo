"use client";

import { ConfirmFormSubmit } from "@/components/admin/confirm-form-submit";
import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import { ClerkSessionBar } from "@/features/saleroom/components/clerk-console/clerk-session-bar";
import { LotOnBlockPanel } from "@/features/saleroom/components/clerk-console/lot-on-block-panel";
import { LotRunwayPanel } from "@/features/saleroom/components/clerk-console/lot-runway-panel";
import { SaleroomActivityLog } from "@/features/saleroom/components/clerk-console/saleroom-activity-log";
import { TelephoneLinesPanel } from "@/features/saleroom/components/clerk-console/telephone-lines-panel";
import { SaleroomLiveShell } from "@/features/saleroom/components/saleroom-live-shell";
import { useClerkLotLiveBidState } from "@/hooks/use-clerk-lot-live-price";
import {
  adminSaleroomCloseAction,
  adminSaleroomGoLiveAction,
  adminSaleroomHammerAction,
  adminSaleroomNoSaleAction,
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
import type { Lot, SaleDeliveryMode } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import Link from "next/link";
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
  registrationsHref?: string;
  paddleRosterEmpty?: boolean;
  checkedInRefresh?: boolean;
};

function ClerkConsoleInner({
  saleId,
  saleTitle,
  deliveryMode,
  saleStatus,
  lots,
  telephoneBookings = [],
  paddleRoster = [],
  error,
  registrationsHref,
  paddleRosterEmpty = false,
  checkedInRefresh = false,
  session,
  activityLog,
}: Omit<Props, "initial"> & {
  session: ReturnType<
    typeof import("@/features/saleroom/hooks/use-staff-saleroom-live").useStaffSaleroomLive
  >["session"];
  activityLog: ReturnType<
    typeof import("@/features/saleroom/hooks/use-staff-saleroom-live").useStaffSaleroomLive
  >["activityLog"];
}) {
  const router = useRouter();

  useEffect(() => {
    if (checkedInRefresh) {
      router.refresh();
    }
  }, [checkedInRefresh, router]);

  const orderedLots = useMemo(() => sortLotsForRunList(lots), [lots]);
  const currentLotId = session.currentLotId;
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

  const sessionStatus = session.status;
  const canGoLive =
    sessionStatus === "none" || sessionStatus === "ended" || sessionStatus === "pending";
  const canPause = sessionStatus === "live";
  const canResume = sessionStatus === "paused";
  const canClose = sessionStatus === "live" || sessionStatus === "paused";
  const canHammer = sessionStatus === "live" && currentLotId != null;

  return (
    <div className="space-y-6">
      {paddleRosterEmpty && registrationsHref ? (
        <Alert>
          <AlertTitle>Check in bidders before going live</AlertTitle>
          <AlertDescription>
            No paddles assigned yet.{" "}
            <Link href={registrationsHref} className="font-medium text-link underline">
              Check in bidders
            </Link>{" "}
            so clerks can place in-room bids.
          </AlertDescription>
        </Alert>
      ) : null}

      {saleStatus && saleStatus !== "active" ? (
        <Alert>
          <AlertTitle>Sale not live yet</AlertTitle>
          <AlertDescription>
            Saleroom session controls work best when the sale status is active.
          </AlertDescription>
        </Alert>
      ) : null}

      {pendingTelForLot > 0 ? (
        <Alert>
          <AlertTitle>Telephone requests for current lot</AlertTitle>
          <AlertDescription>
            {pendingTelForLot} telephone request{pendingTelForLot === 1 ? "" : "s"} may need
            confirmation before the lot opens.
          </AlertDescription>
        </Alert>
      ) : null}

      {selfServiceConflict ? (
        <Alert variant="default">
          <AlertTitle>Online + paddle activity detected</AlertTitle>
          <AlertDescription>
            At least one checked-in paddle has recent self-service bidding — confirm bidders are not
            double-bidding.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load saleroom state</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <ClerkSessionBar
        saleTitle={saleTitle}
        {...(deliveryMode ? { deliveryMode } : {})}
        session={session}
        currentLot={currentLot}
        leaderLabel={liveBid.leaderLabel}
        leaderAmount={liveBid.leaderAmount}
      />

      <div className="flex flex-wrap gap-2" aria-label="Saleroom session controls">
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
        <form id={`saleroom-resume-${saleId}`} action={adminSaleroomResumeAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <SaleroomPendingSubmit
            formId={`saleroom-resume-${saleId}`}
            pendingLabel="Resuming…"
            variant="secondary"
            className="min-h-11"
            disabled={!canResume}
            aria-disabled={!canResume}
          >
            Resume
          </SaleroomPendingSubmit>
        </form>
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LotRunwayPanel
          saleId={saleId}
          lots={orderedLots}
          currentLotId={currentLotId}
          sessionLive={sessionStatus === "live"}
        />
        <div className="lg:sticky lg:top-4 lg:self-start">
          <LotOnBlockPanel
            saleId={saleId}
            currentLotId={currentLotId}
            lots={orderedLots}
            telephoneBookings={telephoneBookings}
            paddleRoster={paddleRoster}
            liveBid={liveBid}
          />
        </div>
      </div>

      <TelephoneLinesPanel saleId={saleId} currentLotId={currentLotId} rows={telephoneBookings} />

      <div className="flex flex-wrap gap-2" aria-label="Lot outcome controls">
        <form id={`saleroom-hammer-${saleId}`} action={adminSaleroomHammerAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <SaleroomPendingSubmit
            formId={`saleroom-hammer-${saleId}`}
            pendingLabel="Recording…"
            variant="default"
            className="min-h-11"
            disabled={!canHammer}
            aria-disabled={!canHammer}
          >
            Hammer (sold)
          </SaleroomPendingSubmit>
        </form>
        <form id={`saleroom-nosale-${saleId}`} action={adminSaleroomNoSaleAction}>
          <input type="hidden" name="saleId" value={saleId} />
          <SaleroomPendingSubmit
            formId={`saleroom-nosale-${saleId}`}
            pendingLabel="Recording…"
            variant="secondary"
            className="min-h-11"
            disabled={!canHammer}
            aria-disabled={!canHammer}
          >
            No sale
          </SaleroomPendingSubmit>
        </form>
      </div>

      <SaleroomActivityLog entries={activityLog} />
    </div>
  );
}

export function SaleroomClerkConsole(props: Props) {
  const initialSession = useMemo(
    () => mapAdminSaleroomSnapshotToSessionStatus(props.initial),
    [props.initial],
  );

  return (
    <SaleroomLiveShell
      saleId={props.saleId}
      initial={initialSession}
      dbEvents={props.initial.events}
      trackLiveFeed
    >
      {({ session, activityLog }) => (
        <ClerkConsoleInner {...props} session={session} activityLog={activityLog} />
      )}
    </SaleroomLiveShell>
  );
}
