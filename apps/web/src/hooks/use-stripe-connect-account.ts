"use client";

import { useConnectStatusPolling } from "@/hooks/use-connect-status-polling";
import {
  ensureStripeConnectAccountAction,
  syncStripeConnectAction,
} from "@/lib/actions/stripe-connect.actions";
import type { StripeConnectStatus } from "@/lib/data/http/stripe-connect.server";
import {
  getConnectGapState,
  isActionableStripeDisabledReason,
  isConnectOnboardingStage,
  shouldSkipConnect,
} from "@auction/connect";
import type { ConnectGapState } from "@auction/connect";
import type { StripeConnectRequirementError } from "@auction/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

function canOnboard(role: string): boolean {
  return role === "owner" || role === "admin";
}

function mergeStatusFromSync(
  prev: StripeConnectStatus | null,
  synced: {
    ready: boolean;
    payoutsEnabled: boolean;
    requirementsDue: string[];
    requirementsErrors: StripeConnectRequirementError[];
    disabledReason: string | null;
  },
): StripeConnectStatus {
  return {
    accountLinked: prev?.accountLinked ?? false,
    chargesEnabled: prev?.chargesEnabled ?? false,
    payoutsEnabled: synced.payoutsEnabled,
    requirementsCurrentlyDue: synced.requirementsDue,
    requirementsErrors: synced.requirementsErrors,
    disabledReason: synced.disabledReason,
    ready: synced.ready,
    syncDegraded: false,
  };
}

type Input = {
  status: StripeConnectStatus | null;
  legalEntityId?: string | undefined;
  memberRole: string;
  entityStatus: string;
  isLaxManaged: boolean;
  kycApproved: boolean;
  connectEnforced: boolean;
  onConnectReady?: (() => void) | undefined;
};

export function useStripeConnectAccount({
  status,
  legalEntityId,
  memberRole,
  entityStatus,
  isLaxManaged,
  kycApproved,
  connectEnforced,
  onConnectReady,
}: Input) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ensureError, setEnsureError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(status);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [ensureAttempted, setEnsureAttempted] = useState(false);
  const [boundaryResetKey, setBoundaryResetKey] = useState(0);
  const [stripeActionRequired, setStripeActionRequired] = useState(0);
  const [pollAfterOnboardingExit, setPollAfterOnboardingExit] = useState(false);
  const [preparingTimedOut, setPreparingTimedOut] = useState(false);

  const PREPARING_TIMEOUT_MS = 30_000;

  useEffect(() => {
    setLocalStatus(status);
  }, [status]);

  const gap: ConnectGapState = useMemo(
    () =>
      getConnectGapState(
        {
          status: entityStatus,
          stripeConnectAccountLinked: localStatus?.accountLinked ?? false,
          stripeConnectPayoutsEnabled: localStatus?.payoutsEnabled ?? false,
          stripeConnectRequirementsCurrentlyDue: localStatus?.requirementsCurrentlyDue ?? [],
          stripeConnectRequirementsErrors: localStatus?.requirementsErrors ?? [],
          stripeConnectDisabledReason: localStatus?.disabledReason ?? null,
          isLaxManaged,
        },
        { kycApproved },
      ),
    [localStatus, isLaxManaged, kycApproved, entityStatus],
  );

  const runEnsureAccount = useCallback(() => {
    setEnsureError(null);
    setError(null);
    setPreparingTimedOut(false);
    setEnsureAttempted(true);
    startTransition(async () => {
      const ensured = await ensureStripeConnectAccountAction(legalEntityId);
      if (!ensured.ok) {
        setEnsureError(ensured.error ?? "Could not create Connect account.");
        return;
      }
      router.refresh();
    });
  }, [legalEntityId, router]);

  useEffect(() => {
    const awaitingAccount =
      connectEnforced &&
      kycApproved &&
      canOnboard(memberRole) &&
      !localStatus?.accountLinked &&
      ensureAttempted &&
      !ensureError;
    if (!awaitingAccount) {
      setPreparingTimedOut(false);
      return;
    }
    const id = window.setTimeout(() => setPreparingTimedOut(true), PREPARING_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [
    connectEnforced,
    ensureAttempted,
    ensureError,
    kycApproved,
    localStatus?.accountLinked,
    memberRole,
  ]);

  useEffect(() => {
    if (shouldSkipConnect({ isLaxManaged }) || !connectEnforced || !kycApproved) return;
    if (!canOnboard(memberRole)) return;
    if (localStatus?.accountLinked || ensureAttempted) return;
    runEnsureAccount();
  }, [
    connectEnforced,
    ensureAttempted,
    isLaxManaged,
    kycApproved,
    localStatus?.accountLinked,
    memberRole,
    runEnsureAccount,
  ]);

  const handleSync = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const synced = await syncStripeConnectAction(legalEntityId);
      if (!synced.ok) {
        setError(synced.error);
        return;
      }
      setLastSyncedAt(new Date());
      setLocalStatus((prev) => mergeStatusFromSync(prev, synced));
      if (synced.ready) {
        onConnectReady?.();
      }
      router.refresh();
    });
  }, [legalEntityId, onConnectReady, router]);

  const handleOnboardingExit = useCallback(() => {
    handleSync();
    setPollAfterOnboardingExit(true);
  }, [handleSync]);

  useEffect(() => {
    if (localStatus?.ready) {
      setPollAfterOnboardingExit(false);
    }
  }, [localStatus?.ready]);

  const { timedOut: pollingTimedOut } = useConnectStatusPolling({
    enabled:
      pollAfterOnboardingExit &&
      !localStatus?.ready &&
      (isActionableStripeDisabledReason(localStatus?.disabledReason) ||
        isConnectOnboardingStage(gap.stage)),
    onPoll: handleSync,
  });

  const reloadEmbeddedSetup = useCallback(() => {
    setBoundaryResetKey((k) => k + 1);
    handleSync();
  }, [handleSync]);

  return {
    localStatus,
    gap,
    pending,
    error,
    setError,
    ensureError,
    lastSyncedAt,
    boundaryResetKey,
    stripeActionRequired,
    setStripeActionRequired,
    handleSync,
    handleOnboardingExit,
    runEnsureAccount,
    reloadEmbeddedSetup,
    pollingTimedOut,
    preparingTimedOut,
  };
}
