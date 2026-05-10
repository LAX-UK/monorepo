"use client";

import {
  postOrgOnboardingStepCompleteAction,
  postOrgSubmitForReviewAction,
  startKycForOrganisationOnboardingAction,
} from "@/app/(marketing)/onboarding/organisation/onboarding-actions";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = { entityId: string; fresh: boolean };

export function OrgIdentityStepClient({ entityId, fresh: _fresh }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onKyc = () => {
    setError(null);
    startTransition(async () => {
      const res = await startKycForOrganisationOnboardingAction(entityId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      window.location.assign(res.url);
    });
  };

  const onSubmit = () => {
    setError(null);
    startTransition(async () => {
      const step = await postOrgOnboardingStepCompleteAction(entityId, "identity");
      if (!step.ok) {
        setError(step.error ?? "Could not save identity step.");
        return;
      }
      const sub = await postOrgSubmitForReviewAction(entityId);
      if (!sub.ok) {
        const extra = sub.missingSteps?.length ? ` Missing: ${sub.missingSteps.join(", ")}.` : "";
        setError((sub.error ?? "Submit failed") + extra);
        return;
      }
      router.push("/dashboard?org_submitted=1");
    });
  };

  return (
    <div className="space-y-6 px-4">
      <h2 className="text-xl font-semibold">Identity verification</h2>
      <p className="text-sm text-on-surface-variant">
        Complete Stripe Identity for your user account, then submit your organisation for review.
        You must be KYC-approved before submission.
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={pending} onClick={onKyc}>
          {pending ? "Starting…" : "Continue to Stripe Identity"}
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={onSubmit}>
          Submit organisation for review
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard">Save and continue later</Link>
        </Button>
      </div>
    </div>
  );
}
