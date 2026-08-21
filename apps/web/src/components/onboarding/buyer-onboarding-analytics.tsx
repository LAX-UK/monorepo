"use client";

import {
  type BuyerOnboardingAnalyticsSource,
  type BuyerPersonalizationEvent,
  trackBuyerPersonalization,
  trackContextualKycGate,
  trackKycOnboarding,
} from "@/lib/analytics/events";
import {
  isContextualReturnSource,
  markContextualKycReturnPending,
  trackContextualKycReturnIfPending,
} from "@/lib/kyc/contextual-kyc-return";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function BuyerInterestsViewTracker({
  source,
}: {
  source: BuyerOnboardingAnalyticsSource;
}) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackBuyerPersonalization({ event: "buyer_interests_viewed", source });
  }, [source]);
  return null;
}

export function BuyerRecommendationsViewTracker({
  source,
  empty = false,
}: {
  source: BuyerOnboardingAnalyticsSource;
  empty?: boolean;
}) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackBuyerPersonalization({
      event: empty ? "buyer_recommendations_empty" : "buyer_recommendations_viewed",
      source,
    });
  }, [empty, source]);
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

export function IdentityOnboardingViewTracker({
  source,
  step,
}: {
  source: BuyerOnboardingAnalyticsSource;
  step: "why" | "verify";
}) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackKycOnboarding({ event: "kyc_onboarding_view", step, source });
  }, [source, step]);
  return null;
}

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
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackContextualKycGate({ event, source });
    if (nextPath) {
      markContextualKycReturnPending({ source, nextPath });
    }
  }, [event, nextPath, source]);
  return null;
}

export function ContextualKycReturnTracker({ kycApproved }: { kycApproved: boolean }) {
  const pathname = usePathname();
  useEffect(() => {
    trackContextualKycReturnIfPending(pathname, kycApproved);
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
