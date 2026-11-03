"use client";

import { openStripeDashboardLinkAction } from "@/lib/actions/stripe-connect.actions";
import { Button } from "@auction/ui/lax";
import { useTransition } from "react";

type Props = {
  pending: boolean;
  legalEntityId?: string | undefined;
  showDashboardLink: boolean;
  hasStripeAccount: boolean;
  showOnboardingForm: boolean;
  payoutReady: boolean;
  showRefreshAction?: boolean;
  onSync: () => void;
  onError: (message: string) => void;
};

export function ConnectActionsBar({
  pending,
  legalEntityId,
  showDashboardLink,
  hasStripeAccount,
  showOnboardingForm,
  payoutReady,
  showRefreshAction = true,
  onSync,
  onError,
}: Props) {
  const [dashboardPending, startDashboardTransition] = useTransition();

  const handleManageInStripe = () => {
    const win = window.open("about:blank", "_blank", "noopener,noreferrer");
    startDashboardTransition(async () => {
      const link = await openStripeDashboardLinkAction(legalEntityId);
      if (!link.ok) {
        win?.close();
        onError(link.error);
        return;
      }
      if (win) {
        win.location.href = link.url;
      } else {
        window.open(link.url, "_blank", "noopener,noreferrer");
      }
    });
  };

  const actionsPending = pending || dashboardPending;

  if (!showRefreshAction && !(showDashboardLink && hasStripeAccount)) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {showRefreshAction ? (
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={actionsPending}
            onClick={onSync}
          >
            {pending ? "Refreshing…" : "Refresh status"}
          </Button>
        ) : null}
        {showDashboardLink && hasStripeAccount ? (
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={actionsPending}
            onClick={handleManageInStripe}
          >
            Manage payout account
          </Button>
        ) : null}
      </div>
      {!payoutReady && showOnboardingForm && showDashboardLink ? (
        <p className="font-body text-xs text-on-surface-variant">
          Use the secure form above. Open your payout account only if you need to change something
          the form doesn't show.
        </p>
      ) : null}
    </>
  );
}
