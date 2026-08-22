"use client";

import { trackRecommendationsContinue } from "@/components/onboarding/buyer-onboarding-analytics";
import { onboardingPrimaryButton } from "@/components/onboarding/buyer-onboarding-shell";
import type { BuyerOnboardingAnalyticsSource } from "@/lib/analytics/events";
import Link from "next/link";

type Props = {
  href: string;
  source: BuyerOnboardingAnalyticsSource;
};

export function RecommendationsContinueLink({ href, source }: Props) {
  return (
    <Link
      href={href}
      className={`${onboardingPrimaryButton} w-full sm:w-auto`}
      onClick={() => trackRecommendationsContinue(source)}
    >
      Continue
    </Link>
  );
}
