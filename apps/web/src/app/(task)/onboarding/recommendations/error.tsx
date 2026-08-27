"use client";

import { BuyerOnboardingRouteError } from "@/components/onboarding/buyer-onboarding-route-error";

export default function RecommendationsOnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BuyerOnboardingRouteError
      title="Recommendations are temporarily unavailable"
      detail="Your interests are saved. Try loading this step again, or continue to identity verification later from your dashboard."
      reset={reset}
      error={error}
    />
  );
}
