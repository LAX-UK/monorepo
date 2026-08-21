"use client";

/**
 * Stripe Connect onboarding (Custom accounts + embedded Connect.js).
 *
 * Identity flow notes:
 * - Individual sellers: Veriff KYC gates Connect; Stripe still collects proof_of_liveness
 *   inside embedded onboarding (required by Stripe — cannot be API-supplied).
 * - Organisations: Connect runs before the org wizard identity step; Stripe collects
 *   representative verification in embedded onboarding while the wizard identity step
 *   covers platform KYC/compliance separately.
 */

import { ConnectActionsBar } from "@/components/connect/connect-actions-bar";
import { ConnectComponentsShellLazy } from "@/components/connect/connect-components-shell-lazy";
import { ConnectErrorBoundary } from "@/components/connect/connect-error-boundary";
import { ConnectInlineAlert } from "@/components/connect/connect-inline-alert";
import { ConnectManagementPanel } from "@/components/connect/connect-management-panel";
import { ConnectNotificationBannerPanel } from "@/components/connect/connect-notification-banner";
import { ConnectOnboardingPanel } from "@/components/connect/connect-onboarding-panel";
import { ConnectPreparingPanel } from "@/components/connect/connect-preparing-panel";
import { ConnectSetupSteps } from "@/components/connect/connect-setup-steps";
import { ConnectStatusHeader } from "@/components/connect/connect-status-header";
import { KycVerificationLauncher } from "@/components/kyc/kyc-verification-launcher";
import { useStripeConnectAccount } from "@/hooks/use-stripe-connect-account";
import {
  type StripeConnectSessionSurface,
  createStripeConnectAccountSessionAction,
} from "@/lib/actions/stripe-connect.actions";
import { connectGapReadOnlySummary, connectGapStageSummary } from "@/lib/connect/connect-gap-copy";
import { deriveConnectWorkspaceFlags } from "@/lib/connect/connect-workspace-flags";
import { DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import type { StripeConnectStatus } from "@/lib/data/http/stripe-connect.server";
import { normalizeKycReturnUrl } from "@/lib/kyc";
import { dashboardIdentityOnboardingHref } from "@/lib/kyc/identity-onboarding";
import { isActionableStripeDisabledReason, shouldSkipConnect } from "@auction/connect";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { useCallback, useMemo } from "react";

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

function canOnboardConnect(role: string): boolean {
  return role === "owner" || role === "admin";
}

function resolveConnectSessionSurface(input: {
  gapStage: string;
  memberRole: string;
  hasStripeAccount: boolean;
}): StripeConnectSessionSurface {
  if (input.gapStage === "ready") return "management";
  if (!canOnboardConnect(input.memberRole) && input.hasStripeAccount) return "management";
  return "onboarding";
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
  returnPath = DASHBOARD_ROUTES.sellerConnect,
  showDashboardLink = false,
  syncDegraded = false,
}: Props) {
  const {
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
  } = useStripeConnectAccount({
    status,
    legalEntityId,
    memberRole,
    entityStatus,
    isLaxManaged,
    kycApproved,
    connectEnforced,
    onConnectReady,
  });

  const surface: StripeConnectSessionSurface = useMemo(
    () =>
      resolveConnectSessionSurface({
        gapStage: gap.stage,
        memberRole,
        hasStripeAccount: Boolean(localStatus?.stripeAccountId),
      }),
    [gap.stage, memberRole, localStatus?.stripeAccountId],
  );

  const hasStripeAccount = Boolean(localStatus?.stripeAccountId);

  const workspaceFlags = deriveConnectWorkspaceFlags({
    memberRole,
    gap,
    stripeActionRequired,
    hasStripeAccount,
  });
  const {
    showOnboardingForm,
    showManagement,
    showFinanceReadOnly,
    showFinanceAwaitingOwner,
    showRefreshAction,
    showPreparingPanel,
    showEmbeddedPanels,
    showRestrictedPanel,
    useCompactHeader,
  } = workspaceFlags;

  const kycReturnUrl = useMemo(() => normalizeKycReturnUrl(returnPath), [returnPath]);

  const fetchClientSecret = useCallback(async () => {
    const result = await createStripeConnectAccountSessionAction(surface, legalEntityId);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.clientSecret;
  }, [surface, legalEntityId]);

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
    return <ConnectInlineAlert kind="role_blocked" />;
  }

  if (!kycApproved) {
    return (
      <div className="space-y-4">
        <ConnectSetupSteps kycApproved={false} payoutComplete={false} />
        <ConnectStatusHeader gap={gap} />
        <Surface variant="section" padding="md" className="space-y-4">
          <p className="font-body text-sm text-on-surface-variant">
            Verify your identity before connecting a payout account.
          </p>
          {onStartKyc ? (
            <KycVerificationLauncher
              returnUrl={kycReturnUrl}
              onStartSession={onStartKyc}
              kycSummary={kycSummary}
            />
          ) : (
            <Button asChild variant="cta" size="sm">
              <a href={dashboardIdentityOnboardingHref("/dashboard/seller/connect")}>
                Verify identity
              </a>
            </Button>
          )}
        </Surface>
      </div>
    );
  }

  const canMountConnectShell = hasStripeAccount && showEmbeddedPanels;
  const showSyncDegraded = syncDegraded || localStatus?.syncDegraded;
  const preparingAccount = showPreparingPanel && pending;
  const showActionablePastDueAlert =
    isActionableStripeDisabledReason(localStatus?.disabledReason) &&
    !localStatus?.ready &&
    !useCompactHeader;

  const actionsBar = (
    <ConnectActionsBar
      pending={pending}
      legalEntityId={legalEntityId}
      showDashboardLink={showDashboardLink}
      hasStripeAccount={hasStripeAccount}
      showOnboardingForm={showOnboardingForm}
      payoutReady={Boolean(localStatus?.ready)}
      showRefreshAction={showRefreshAction}
      onSync={handleSync}
      onError={setError}
    />
  );

  return (
    <div className="space-y-4" data-testid="connect-workspace">
      <ConnectSetupSteps kycApproved payoutComplete={Boolean(localStatus?.ready)} />

      <ConnectStatusHeader
        gap={gap}
        lastSyncedAt={lastSyncedAt}
        compact={useCompactHeader}
        readOnly={showFinanceReadOnly}
      />

      {showFinanceAwaitingOwner ? (
        <ConnectInlineAlert
          kind="role_blocked"
          detail="finance_awaiting_owner"
          title="Payout setup not started"
        />
      ) : null}

      {showRestrictedPanel ? (
        <Surface variant="section" padding="md" className="space-y-2">
          <p className="font-body text-sm text-on-surface">
            {connectGapStageSummary("restricted", gap, { readOnly: showFinanceReadOnly })}
          </p>
        </Surface>
      ) : null}

      {showSyncDegraded ? <ConnectInlineAlert kind="sync_degraded" /> : null}

      {error ? <ConnectInlineAlert kind="generic" detail={error} /> : null}

      {pollingTimedOut ? <ConnectInlineAlert kind="polling_timed_out" /> : null}

      {!localStatus?.ready && showOnboardingForm && !useCompactHeader ? (
        <p className="font-body text-sm text-on-surface-variant">
          Complete the steps below. We&apos;ll refresh your status when you exit the form.
        </p>
      ) : null}

      {showActionablePastDueAlert ? (
        <Alert>
          <AlertDescription className="font-body text-sm">
            Some payout details are overdue. Complete the form below to restore payouts — no need to
            contact support unless the form won&apos;t load.
          </AlertDescription>
        </Alert>
      ) : null}

      {showRefreshAction ? actionsBar : null}

      {canMountConnectShell ? (
        <ConnectErrorBoundary
          resetKey={`${surface}-${boundaryResetKey}`}
          onReload={reloadEmbeddedSetup}
        >
          <ConnectComponentsShellLazy
            publishableKey={publishableKey}
            fetchClientSecret={fetchClientSecret}
          >
            <ConnectNotificationBannerPanel
              onNotificationsChange={({ actionRequired }) =>
                setStripeActionRequired(actionRequired)
              }
            />
            {showOnboardingForm ? (
              <Surface variant="section" padding="md" className="space-y-4">
                {!useCompactHeader ? (
                  <>
                    <h3 className="font-headline text-base font-semibold text-on-surface">
                      Complete your payout details
                    </h3>
                    <p className="font-body text-sm text-on-surface-variant">
                      Add your bank account and any verification Stripe requests. Prefer this form
                      over opening Stripe separately.
                    </p>
                  </>
                ) : null}
                <ConnectOnboardingPanel onExit={handleOnboardingExit} />
              </Surface>
            ) : null}
            {showManagement ? (
              <Surface variant="section" padding="md" className="space-y-4">
                {showFinanceReadOnly && gap.stage !== "ready" ? (
                  <p className="font-body text-sm text-on-surface-variant">
                    {connectGapReadOnlySummary(gap.stage)}
                  </p>
                ) : null}
                <ConnectManagementPanel />
              </Surface>
            ) : null}
          </ConnectComponentsShellLazy>
        </ConnectErrorBoundary>
      ) : showPreparingPanel ? (
        <ConnectPreparingPanel
          preparingAccount={preparingAccount}
          ensureError={ensureError}
          pending={pending}
          timedOut={preparingTimedOut}
          onRetry={runEnsureAccount}
        />
      ) : null}
    </div>
  );
}
