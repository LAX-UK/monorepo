"use client";

import { type KycOnboardingEvent, trackKycOnboarding } from "@/lib/analytics/events";
import { trackOnce } from "@/lib/analytics/track-once";
import type {
  IdentityOnboardingSource,
  IdentityOnboardingStep,
} from "@/lib/kyc/identity-onboarding";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

export function IdentityOnboardingViewTracker({
  step,
  source = "direct",
}: {
  step: IdentityOnboardingStep;
  source?: IdentityOnboardingSource;
}) {
  const pathname = usePathname();
  useEffect(() => {
    trackOnce(`buyer-onboarding:identity:${step}:${source}:${pathname}`, () => {
      trackKycOnboarding({ event: "kyc_onboarding_view", step, source });
    });
  }, [pathname, source, step]);

  return null;
}

export function TrackedIdentityOnboardingLink({
  href,
  event,
  step,
  source = "direct",
  children,
}: {
  href: string;
  event: KycOnboardingEvent;
  step: IdentityOnboardingStep;
  source?: IdentityOnboardingSource;
  children: ReactNode;
}) {
  return (
    <Link href={href} onClick={() => trackKycOnboarding({ event, step, source })}>
      {children}
    </Link>
  );
}
