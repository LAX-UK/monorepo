"use client";

import { BidBlockerNotice } from "@/components/bid/bid-blocker-notice";
import { ContextualKycGateTracker } from "@/components/onboarding/buyer-onboarding-analytics";
import type { BidBlockerPresentation } from "@/lib/bid/bid-blocker-presentation";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import { contextualIdentityOnboardingHref } from "@/lib/kyc/identity-onboarding";
import { resolveKycBidBlockerPresentation } from "@/lib/kyc/kyc-bid-blocker-presentation";

type Props = {
  /** Post-verification return path (e.g. lot page). Passed as identity onboarding `?next=`. */
  returnPath?: string;
  lotId?: string;
  strict?: boolean;
  feedback?: Pick<KycUserFeedbackDto, "headline" | "detail" | "needsResubmit" | "action"> | null;
  presentation?: BidBlockerPresentation;
};

export function KycThresholdCallout({
  returnPath,
  lotId,
  strict = false,
  feedback,
  presentation,
}: Props) {
  const verifyHref = contextualIdentityOnboardingHref(returnPath, "bid_gate", lotId);
  const resolved =
    presentation ??
    resolveKycBidBlockerPresentation({
      href: verifyHref,
      strict,
      feedback,
    });

  return (
    <>
      <ContextualKycGateTracker source="bid_gate" nextPath={returnPath ?? null} />
      <BidBlockerNotice presentation={resolved} />
    </>
  );
}
