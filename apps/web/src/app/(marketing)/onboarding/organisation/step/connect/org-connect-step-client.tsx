"use client";

import {
  postOrgOnboardingStepCompleteAction,
  stripeConnectEnsureOrgAction,
  stripeConnectOnboardingLinkOrgAction,
} from "@/app/(marketing)/onboarding/organisation/onboarding-actions";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = { entityId: string; fresh: boolean };

export function OrgConnectStepClient({ entityId, fresh }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const buildQuery = () => {
    const qs = new URLSearchParams({ entityId });
    if (fresh) qs.set("fresh", "1");
    return qs.toString();
  };

  const onStripe = () => {
    setError(null);
    startTransition(async () => {
      const ensured = await stripeConnectEnsureOrgAction(entityId);
      if (!ensured.ok) {
        setError(ensured.error ?? "Could not start Stripe Connect.");
        return;
      }
      const link = await stripeConnectOnboardingLinkOrgAction(entityId);
      if (!link.ok) {
        setError(link.error);
        return;
      }
      window.location.assign(link.url);
    });
  };

  const onContinue = () => {
    setError(null);
    startTransition(async () => {
      const res = await postOrgOnboardingStepCompleteAction(entityId, "connect");
      if (!res.ok) {
        setError(res.error ?? "Finish Stripe Connect onboarding first.");
        return;
      }
      router.push(`/onboarding/organisation/step/identity?${buildQuery()}`);
    });
  };

  return (
    <div className="space-y-6 px-4">
      <h2 className="text-xl font-semibold">Stripe Connect</h2>
      <p className="text-sm text-on-surface-variant">
        Connect your organisation to receive payouts. You will leave this site briefly to complete
        Stripe Express onboarding.
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={pending} onClick={onStripe}>
          {pending ? "Opening Stripe…" : "Continue to Stripe Connect"}
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={onContinue}>
          I&apos;ve finished Connect — continue
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard">Save and continue later</Link>
        </Button>
      </div>
    </div>
  );
}
