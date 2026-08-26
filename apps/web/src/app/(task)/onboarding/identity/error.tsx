"use client";

import { BuyerOnboardingRouteError } from "@/components/onboarding/buyer-onboarding-route-error";

export default function IdentityOnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BuyerOnboardingRouteError
      title="Verification setup is temporarily unavailable"
      detail="Your progress is safe. Try loading this step again, or return to your dashboard."
      reset={reset}
      error={error}
    />
  );
}
