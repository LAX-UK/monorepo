"use client";

import { ConnectAccountOnboarding } from "@stripe/react-connect-js";
import { useEffect, useRef } from "react";

type Props = {
  onExit: () => void;
};

export function ConnectOnboardingPanel({ onExit }: Props) {
  const onboardingRef = useRef<{ setCollectionOptions?: (opts: unknown) => void } | null>(null);

  useEffect(() => {
    onboardingRef.current?.setCollectionOptions?.({
      fields: "eventually_due",
      futureRequirements: "include",
    });
  }, []);

  return (
    <div data-testid="connect-onboarding-panel" className="min-h-[420px]">
      <ConnectAccountOnboarding
        // @ts-expect-error Stripe SDK ref typing
        onboarding={onboardingRef}
        onExit={onExit}
      />
    </div>
  );
}
