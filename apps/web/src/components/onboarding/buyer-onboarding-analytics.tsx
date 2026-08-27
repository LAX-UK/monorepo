"use client";

import { IdentityOnboardingViewTracker } from "@/components/kyc/identity-onboarding-tracking";
import {
  type BuyerOnboardingAnalyticsSource,
  type BuyerPersonalizationEvent,
  trackBuyerPersonalization,
  trackContextualKycGate,
} from "@/lib/analytics/events";
import { trackOnce } from "@/lib/analytics/track-once";
import {
  isContextualReturnSource,
  markContextualKycReturnPending,
  trackContextualKycReturnIfPending,
} from "@/lib/kyc/contextual-kyc-return";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function BuyerInterestsViewTracker({
  source,
}: {
  source: BuyerOnboardingAnalyticsSource;
}) {
  const pathname = usePathname();
  useEffect(() => {
    trackOnce(`buyer-onboarding:interests:${source}:${pathname}`, () => {
      trackBuyerPersonalization({ event: "buyer_interests_viewed", source });
    });
  }, [pathname, source]);
  return null;
}

export function BuyerRecommendationsViewTracker({
  source,
  empty = false,
}: {
  source: BuyerOnboardingAnalyticsSource;
  empty?: boolean;
}) {
  const pathname = usePathname();
  useEffect(() => {
    const event = empty ? "buyer_recommendations_empty" : "buyer_recommendations_viewed";
    trackOnce(`buyer-onboarding:recommendations:${event}:${source}:${pathname}`, () => {
      trackBuyerPersonalization({ event, source });
    });
  }, [empty, pathname, source]);
  return null;
}

export function trackBuyerInterestsSubmission(input: {
  skipped: boolean;
  selectedCount: number;
  source: BuyerOnboardingAnalyticsSource;
}) {
  trackBuyerPersonalization({
    event: input.skipped ? "buyer_interests_skipped" : "buyer_interests_completed",
    source: input.source,
    selectedCount: input.selectedCount,
  });
}

export function trackRecommendationsContinue(source: BuyerOnboardingAnalyticsSource) {
  trackBuyerPersonalization({ event: "buyer_recommendations_continued", source });
}

export { IdentityOnboardingViewTracker };

export function ContextualKycGateTracker({
  source,
  nextPath,
  event = "contextual_kyc_gate_triggered",
}: {
  source: Extract<
    BuyerOnboardingAnalyticsSource,
    "bid_gate" | "registration" | "telephone" | "condition_report"
  >;
  nextPath?: string | null;
  event?: Extract<
    BuyerPersonalizationEvent,
    "contextual_kyc_gate_triggered" | "contextual_kyc_returned"
  >;
}) {
  const pathname = usePathname();
  useEffect(() => {
    trackOnce(`buyer-onboarding:contextual:${event}:${source}:${pathname}`, () => {
      trackContextualKycGate({ event, source });
    });
    if (nextPath) {
      markContextualKycReturnPending({ source, nextPath });
    }
  }, [event, nextPath, pathname, source]);
  return null;
}

export function ContextualKycReturnTracker({ kycApproved }: { kycApproved: boolean }) {
  const pathname = usePathname();
  useEffect(() => {
    trackContextualKycReturnIfPending(`${pathname}${window.location.search}`, kycApproved);
  }, [kycApproved, pathname]);
  return null;
}

export function markContextualKycGateNavigation(
  source: BuyerOnboardingAnalyticsSource,
  nextPath: string,
) {
  if (!isContextualReturnSource(source)) return;
  markContextualKycReturnPending({ source, nextPath });
}
