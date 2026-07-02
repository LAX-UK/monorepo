"use client";

import { useLotRunway } from "@/features/saleroom/hooks/use-lot-runway";
import { resolveClerkActionPolicy } from "@/features/saleroom/lib/clerk-action-policy";
import { buildClerkConsoleAlertDefinitions } from "@/features/saleroom/lib/clerk-console-alerts";
import { deriveClerkLivePhase } from "@/features/saleroom/lib/clerk-live-phase";
import { CLERK_PHASE_LAYOUT } from "@/features/saleroom/lib/clerk-phase-layout";
import type { ClerkConsoleModel } from "@/features/saleroom/types/clerk-console.types";
import type {
  SaleroomActivityEntry,
  StaffSaleroomSessionVM,
} from "@/features/saleroom/types/staff-saleroom.vm";
import type { ClerkLotLiveBidState } from "@/hooks/use-clerk-lot-live-price";
import type {
  AdminPaddleRosterEntry,
  AdminTelephoneBookingRow,
} from "@/lib/data/http/admin.server";
import { sortLotsForRunList } from "@/lib/saleroom/sort-lots-for-run-list";
import type { Lot, SaleDeliveryMode } from "@auction/types";
import { useMemo } from "react";

type Input = {
  saleId: string;
  saleTitle: string;
  deliveryMode?: SaleDeliveryMode;
  saleStatus?: string;
  lots: Lot[];
  telephoneBookings: AdminTelephoneBookingRow[];
  paddleRoster: AdminPaddleRosterEntry[];
  paddleRosterEmpty: boolean;
  hammeredLotIds: ReadonlySet<string>;
  registrationsHref?: string;
  loadWarnings?: string[];
  error?: string | null;
  session: StaffSaleroomSessionVM;
  activityLog: SaleroomActivityEntry[];
  liveBid: ClerkLotLiveBidState;
};

export function useClerkConsoleModel(input: Input): ClerkConsoleModel {
  const {
    saleId,
    saleTitle,
    deliveryMode,
    saleStatus,
    lots,
    telephoneBookings,
    paddleRoster,
    paddleRosterEmpty,
    hammeredLotIds,
    registrationsHref,
    loadWarnings = [],
    error,
    session,
    activityLog,
    liveBid,
  } = input;

  const sessionStatus = session.status;
  const currentLotId = session.currentLotId;
  const { progress, nextLot } = useLotRunway({
    lots,
    currentLotId,
    sessionStatus,
    hammeredLotIds,
  });

  const orderedLots = useMemo(() => sortLotsForRunList(lots), [lots]);
  const currentLot = orderedLots.find((lot) => lot.id === currentLotId) ?? null;

  const selfServiceConflict = paddleRoster.some((p) => p.hasActiveSelfServiceSession);
  const pendingTelForLot =
    currentLotId != null
      ? telephoneBookings.filter(
          (b) =>
            b.status === "requested" && (b.lotIds.length === 0 || b.lotIds.includes(currentLotId)),
        ).length
      : 0;

  const sessionLive = sessionStatus === "live";
  const allLotsDone =
    (sessionStatus === "live" || sessionStatus === "paused") &&
    nextLot == null &&
    currentLotId == null;
  const livePhase = deriveClerkLivePhase(sessionStatus, progress, currentLotId, allLotsDone);
  const phaseLayout = CLERK_PHASE_LAYOUT[livePhase];
  const canHammer = sessionLive && currentLotId != null;

  const policy = resolveClerkActionPolicy({
    phase: livePhase,
    sessionStatus,
    canHammer,
    nextLot,
    betweenLots: progress.betweenLots,
  });

  const alerts = buildClerkConsoleAlertDefinitions({
    paddleRosterEmpty,
    ...(saleStatus ? { saleStatus } : {}),
    livePhase,
    pendingTelForLot,
    selfServiceConflict,
    ...(error != null ? { error } : {}),
    loadWarnings,
  });

  const showActionBar = sessionLive && (policy.advanceInDock || policy.hammerInDock);

  return {
    session: {
      saleId,
      saleTitle,
      ...(deliveryMode ? { deliveryMode } : {}),
      session,
      livePhase,
      activityLog,
    },
    lot: {
      lots: orderedLots,
      currentLotId,
      currentLot,
      progress,
      nextLot,
      liveBid,
    },
    roster: {
      paddleRoster,
      telephoneBookings,
      ...(registrationsHref ? { registrationsHref } : {}),
    },
    action: {
      policy,
      canHammer,
      sessionLive,
      sessionStatus,
    },
    feedback: {
      alerts,
      loadWarnings,
      ...(error != null ? { error } : {}),
      ...(registrationsHref ? { registrationsHref } : {}),
    },
    phaseLayout,
    pendingTelForLot,
    showActionBar,
  };
}
