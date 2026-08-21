"use client";

import { type KycOnboardingEvent, trackKycOnboarding } from "@/lib/analytics/events";
import type {
  IdentityOnboardingSource,
  IdentityOnboardingStep,
} from "@/lib/kyc/identity-onboarding";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

export function IdentityOnboardingViewTracker({
  step,
  source = "direct",
}: {
  step: IdentityOnboardingStep;
  source?: IdentityOnboardingSource;
}) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackKycOnboarding({ event: "kyc_onboarding_view", step, source });
  }, [source, step]);

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
