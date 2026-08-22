"use client";

import { ContextualKycGateTracker } from "@/components/onboarding/buyer-onboarding-analytics";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import { contextualIdentityOnboardingHref } from "@/lib/kyc/identity-onboarding";
import Link from "next/link";
import { KYC_BID_BLOCKED_DESCRIPTION, kycLinkActionLabel } from "./kyc-copy";

type Props = {
  /** Post-verification return path (e.g. lot page). Passed as identity onboarding `?next=`. */
  returnPath?: string;
  lotId?: string;
  strict?: boolean;
  feedback?: Pick<KycUserFeedbackDto, "headline" | "detail" | "needsResubmit" | "action"> | null;
};

export function KycThresholdCallout({ returnPath, lotId, strict = false, feedback }: Props) {
  const verifyHref = contextualIdentityOnboardingHref(returnPath, "bid_gate", lotId);

  const headline = feedback?.headline ?? "Identity verification required";
  const detail = strict
    ? "Your identity must be approved before you can place bids."
    : (feedback?.detail ?? KYC_BID_BLOCKED_DESCRIPTION);
  const ctaLabel = kycLinkActionLabel(feedback, "long");

  return (
    <div
      className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-4 text-center text-sm text-on-surface-variant"
      role="alert"
      aria-live="polite"
    >
      <p className="font-medium text-on-surface">{headline}</p>
      <p className="mt-2 text-pretty">{detail}</p>
      <p className="mt-3">
        <ContextualKycGateTracker source="bid_gate" nextPath={returnPath ?? null} />
        <Link className="font-semibold text-link underline underline-offset-2" href={verifyHref}>
          {ctaLabel}
        </Link>
      </p>
    </div>
  );
}
