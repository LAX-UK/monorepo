"use client";

import { postOrgOnboardingStepCompleteAction } from "@/app/(task)/onboarding/organisation/onboarding-actions";
import { ConnectWorkspace } from "@/components/connect/connect-workspace";
import { humanizeOrgConnectStepError } from "@/lib/connect/org-onboarding-connect-errors";
import type { StripeConnectStatus } from "@/lib/data/http/stripe-connect.server";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

type Props = {
  entityId: string;
  fresh: boolean;
  publishableKey: string | null;
  connectEnforced: boolean;
  status: StripeConnectStatus | null;
  syncDegraded?: boolean;
  memberRole: string;
  entityStatus: string;
  isLaxManaged: boolean;
};

export function OrgConnectStepClient({
  entityId,
  fresh,
  publishableKey,
  connectEnforced,
  status,
  syncDegraded = false,
  memberRole,
  entityStatus,
  isLaxManaged,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [connectReady, setConnectReady] = useState(Boolean(status?.ready));

  const identityStepQuery = fresh ? `entityId=${entityId}&fresh=1` : `entityId=${entityId}`;

  const advanceWizard = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const res = await postOrgOnboardingStepCompleteAction(entityId, "connect");
      if (!res.ok) {
        setError(humanizeOrgConnectStepError(res.error));
        return;
      }
      router.push(`/onboarding/organisation/step/identity?${identityStepQuery}`);
    });
  }, [entityId, identityStepQuery, router]);

  const onConnectReady = useCallback(() => {
    setConnectReady(true);
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Payout setup</h2>
        <p className="text-sm text-on-surface-variant">
          Connect your organisation to receive payouts. Complete Stripe Express verification below —
          no redirect required.
        </p>
      </div>

      <ConnectWorkspace
        publishableKey={publishableKey}
        connectEnforced={connectEnforced}
        status={status}
        legalEntityId={entityId}
        memberRole={memberRole}
        entityStatus={entityStatus}
        kycApproved
        isLaxManaged={isLaxManaged}
        onConnectReady={onConnectReady}
        returnPath={`/onboarding/organisation/step/connect?entityId=${encodeURIComponent(entityId)}`}
        showDashboardLink={false}
        syncDegraded={syncDegraded}
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={pending || !connectReady} onClick={advanceWizard}>
          Continue to identity verification
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard">Save and continue later</Link>
        </Button>
      </div>
    </div>
  );
}
