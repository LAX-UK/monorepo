"use client";

import { BuyerOnboardingRouteError } from "@/components/onboarding/buyer-onboarding-route-error";

export default function InterestsOnboardingError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BuyerOnboardingRouteError
      title="Interests setup is temporarily unavailable"
      detail="Your progress is safe. Try loading this step again, or return to your dashboard."
      reset={reset}
    />
  );
}
