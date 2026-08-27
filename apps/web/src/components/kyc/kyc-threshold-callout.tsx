"use client";

import { BidBlockerNotice } from "@/components/bid/bid-blocker-notice";
import { resolveKycBidBlockerPresentation } from "@/lib/bid/presenters/kyc-blocker.presenter";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import { contextualIdentityOnboardingHref } from "@/lib/kyc/identity-onboarding";

type Props = {
  returnPath?: string;
  lotId?: string;
  strict?: boolean;
  feedback?: Pick<KycUserFeedbackDto, "headline" | "detail" | "needsResubmit" | "action"> | null;
};

export function KycThresholdCallout({ returnPath, lotId, strict = false, feedback }: Props) {
  return (
    <BidBlockerNotice
      presentation={resolveKycBidBlockerPresentation({
        href: contextualIdentityOnboardingHref(returnPath, "bid_gate", lotId),
        strict,
        feedback,
      })}
    />
  );
}
