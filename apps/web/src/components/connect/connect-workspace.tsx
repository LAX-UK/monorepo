"use client";

import { ConnectComponentsShell } from "@/components/connect/connect-components-shell";
import { ConnectErrorBoundary } from "@/components/connect/connect-error-boundary";
import { ConnectManagementPanel } from "@/components/connect/connect-management-panel";
import { ConnectNotificationBannerPanel } from "@/components/connect/connect-notification-banner";
import { ConnectOnboardingPanel } from "@/components/connect/connect-onboarding-panel";
import { ConnectStatusHeader } from "@/components/connect/connect-status-header";
import { KycVerificationLauncher } from "@/components/kyc/kyc-verification-launcher";
import {
  type StripeConnectSessionSurface,
  createStripeConnectAccountSessionAction,
  ensureStripeConnectAccountAction,
  openStripeDashboardLinkAction,
  syncStripeConnectAction,
} from "@/lib/actions/stripe-connect.actions";
import { connectGapStageSummary } from "@/lib/connect/connect-gap-copy";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import type { StripeConnectStatus } from "@/lib/data/http/stripe-connect.server";
import { getConnectGapState, shouldSkipConnect } from "@auction/connect";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

type Props = {
  publishableKey: string | null;
  connectEnforced: boolean;
  status: StripeConnectStatus | null;
  legalEntityId?: string;
  memberRole: string;
  entityStatus?: string;
  /** Individual sellers only — gate Connect until Veriff approved. */
  kycApproved?: boolean;
  kycSummary?: KycStatusSummaryDto | null;
  onStartKyc?: (
    returnUrl: string,
  ) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
  isLaxManaged?: boolean;
  /** Org wizard: call after sync confirms Connect is configured. */
  onConnectReady?: () => void;
  returnPath?: string;
  showDashboardLink?: boolean;
  /** When server sync failed and cached flags were returned. */
  syncDegraded?: boolean;
};

function canManageConnect(role: string): boolean {
  return role === "owner" || role === "admin" || role === "finance";
}

function canOnboard(role: string): boolean {
  return role === "owner" || role === "admin";
}

function mergeStatusFromSync(
  prev: StripeConnectStatus | null,
  synced: { ready: boolean; payoutsEnabled: boolean; requirementsDue: string[] },
): StripeConnectStatus {
  return {
    stripeAccountId: prev?.stripeAccountId ?? null,
    chargesEnabled: prev?.chargesEnabled ?? false,
    payoutsEnabled: synced.payoutsEnabled,
    requirementsCurrentlyDue: synced.requirementsDue,
    disabledReason: prev?.disabledReason ?? null,
    ready: synced.ready,
    syncDegraded: false,
  };
}

export function ConnectWorkspace({
  publishableKey,
  connectEnforced,
  status,
  legalEntityId,
  memberRole,
  kycApproved = true,
  kycSummary = null,
  onStartKyc,
  isLaxManaged = false,
  entityStatus = "approved",
  onConnectReady,
  returnPath = "/dashboard/seller/connect",
  showDashboardLink = true,
  syncDegraded = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ensureError, setEnsureError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(status);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [ensureAttempted, setEnsureAttempted] = useState(false);
  const [boundaryResetKey, setBoundaryResetKey] = useState(0);

  useEffect(() => {
    setLocalStatus(status);
  }, [status]);

  const gap = useMemo(
    () =>
      getConnectGapState(
        {
          status: entityStatus,
          stripeConnectAccountId: localStatus?.stripeAccountId ?? null,
          stripeConnectPayoutsEnabled: localStatus?.payoutsEnabled ?? false,
          stripeConnectRequirementsCurrentlyDue: localStatus?.requirementsCurrentlyDue ?? [],
          stripeConnectDisabledReason: localStatus?.disabledReason ?? null,
          isLaxManaged,
        },
        { kycApproved },
      ),
    [localStatus, isLaxManaged, kycApproved, entityStatus],
  );

  const surface: StripeConnectSessionSurface = useMemo(() => {
    if (gap.stage === "ready") return "management";
    if (!canOnboard(memberRole)) return "management";
    return "onboarding";
  }, [gap.stage, memberRole]);

  const fetchClientSecret = useCallback(async () => {
    const result = await createStripeConnectAccountSessionAction(surface, legalEntityId);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.clientSecret;
  }, [surface, legalEntityId]);

  const runEnsureAccount = useCallback(() => {
    setEnsureError(null);
    setError(null);
    setEnsureAttempted(true);
    startTransition(async () => {
      const ensured = await ensureStripeConnectAccountAction(legalEntityId);
      if (!ensured.ok) {
        setEnsureError(ensured.error ?? "Could not create Connect account.");
        setEnsureAttempted(false);
        return;
      }
      router.refresh();
    });
  }, [legalEntityId, router]);

  useEffect(() => {
    if (shouldSkipConnect({ isLaxManaged }) || !connectEnforced || !kycApproved) return;
    if (!canOnboard(memberRole)) return;
    if (localStatus?.stripeAccountId || ensureAttempted) return;
    runEnsureAccount();
  }, [
    connectEnforced,
    ensureAttempted,
    isLaxManaged,
    kycApproved,
    localStatus?.stripeAccountId,
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
  }, [handleSync]);

  const reloadEmbeddedSetup = useCallback(() => {
    setBoundaryResetKey((k) => k + 1);
    handleSync();
  }, [handleSync]);

  if (shouldSkipConnect({ isLaxManaged })) {
    return (
      <Surface variant="section" padding="md" className="space-y-2">
        <p className="font-body text-sm text-on-surface">
          {connectGapStageSummary("managed_by_lax")}
        </p>
      </Surface>
    );
  }

  if (!connectEnforced || !publishableKey) {
    return (
      <Surface variant="section" padding="md" className="space-y-2">
        <p className="font-body text-sm text-on-surface-variant">
          Payout setup is not available in this environment yet. Contact support if you need help.
        </p>
      </Surface>
    );
  }

  if (!canManageConnect(memberRole)) {
    return (
      <Surface variant="section" padding="md" className="space-y-2">
        <p className="font-body text-sm text-on-surface-variant">
          Ask an organisation owner or admin to complete payout setup.
        </p>
      </Surface>
    );
  }

  if (!kycApproved) {
    return (
      <div className="space-y-4">
        <ConnectStatusHeader gap={gap} />
        <Surface variant="section" padding="md" className="space-y-4">
          <p className="font-body text-sm text-on-surface-variant">
            Verify your identity before connecting a payout account.
          </p>
          {onStartKyc ? (
            <KycVerificationLauncher
              returnUrl={returnPath}
              onStartSession={onStartKyc}
              kycSummary={kycSummary}
            />
          ) : (
            <Button asChild variant="cta" size="sm">
              <a href="/dashboard/verify-identity">Verify identity</a>
            </Button>
          )}
        </Surface>
      </div>
    );
  }

  const showOnboarding = canOnboard(memberRole) && surface === "onboarding";
  const showManagement = surface === "management";
  const canMountConnectShell = Boolean(localStatus?.stripeAccountId);
  const showSyncDegraded = syncDegraded || localStatus?.syncDegraded;

  return (
    <div className="space-y-4" data-testid="connect-workspace">
      <ConnectStatusHeader gap={gap} lastSyncedAt={lastSyncedAt} />

      {showSyncDegraded ? (
        <Alert>
          <AlertDescription className="font-body text-sm">
            We could not reach Stripe for a live status check. Showing the last known state — use
            Refresh status to try again.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <p className="font-body text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      {!localStatus?.ready && showOnboarding ? (
        <p className="font-body text-sm text-on-surface-variant">
          Complete the steps below. We&apos;ll refresh your status when you exit the form.
        </p>
      ) : null}

      {!canOnboard(memberRole) && gap.stage !== "ready" && !localStatus?.stripeAccountId ? (
        <Surface variant="section" padding="md" className="space-y-2">
          <p className="font-body text-sm text-on-surface-variant">
            Payout onboarding has not started yet. Ask an organisation owner or admin to begin
            setup.
          </p>
        </Surface>
      ) : null}

      {canMountConnectShell ? (
        <ConnectErrorBoundary
          resetKey={`${surface}-${boundaryResetKey}`}
          onReload={reloadEmbeddedSetup}
        >
          <ConnectComponentsShell
            publishableKey={publishableKey}
            fetchClientSecret={fetchClientSecret}
          >
            <ConnectNotificationBannerPanel />
            {showOnboarding ? <ConnectOnboardingPanel onExit={handleOnboardingExit} /> : null}
            {showManagement ? <ConnectManagementPanel /> : null}
          </ConnectComponentsShell>
        </ConnectErrorBoundary>
      ) : canOnboard(memberRole) ? (
        <div className="rounded-lg border border-outline-variant/30 p-6">
          <p className="font-body text-sm text-on-surface-variant">
            {pending ? "Preparing your payout account…" : "Loading payout setup…"}
          </p>
          {ensureError ? (
            <div className="mt-3 space-y-2">
              <p className="font-body text-sm text-error" role="alert">
                {ensureError}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={runEnsureAccount}
              >
                Try again
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={handleSync}>
          Refresh status
        </Button>
        {showDashboardLink && localStatus?.stripeAccountId ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const link = await openStripeDashboardLinkAction(legalEntityId);
                if (!link.ok) {
                  setError(link.error);
                  return;
                }
                window.open(link.url, "_blank", "noopener,noreferrer");
              });
            }}
          >
            Open Stripe Express
          </Button>
        ) : null}
      </div>
    </div>
  );
}
