import { IdentityOnboardingViewTracker } from "@/components/kyc/identity-onboarding-tracking";
import { LaxLogo } from "@/components/layout/lax-logo";
import {
  IDENTITY_ONBOARDING_STEPS,
  type IdentityOnboardingSource,
  type IdentityOnboardingStep,
} from "@/lib/kyc/identity-onboarding";
import { DisplayHeading, LabelCaps } from "@auction/ui";
import { WizardProgress } from "@auction/ui/components/wizard-progress";
import type { ReactNode } from "react";

type Props = {
  step: IdentityOnboardingStep;
  title: string;
  description: string;
  children: ReactNode;
  source?: IdentityOnboardingSource;
};

export function IdentityOnboardingShell({ step, title, description, children, source }: Props) {
  const currentIndex = IDENTITY_ONBOARDING_STEPS.findIndex((candidate) => candidate.id === step);

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 px-5 py-8 sm:px-8 sm:py-12"
    >
      <IdentityOnboardingViewTracker step={step} {...(source ? { source } : {})} />
      <LaxLogo variant="auth" className="shrink-0" />
      <div className="w-full max-w-xl">
        <WizardProgress
          steps={IDENTITY_ONBOARDING_STEPS}
          currentIndex={currentIndex}
          maxReachableIndex={currentIndex}
          variant="bar"
          showUpNext
        />
      </div>
      <header className="flex max-w-3xl flex-col items-center gap-3 text-center">
        <LabelCaps>Identity verification</LabelCaps>
        <DisplayHeading as="h1" size="section" className="font-semibold uppercase tracking-tight">
          {title}
        </DisplayHeading>
        <p className="max-w-2xl text-pretty font-body text-base leading-7 text-on-surface-variant">
          {description}
        </p>
      </header>
      <div className="w-full">{children}</div>
    </main>
  );
}
