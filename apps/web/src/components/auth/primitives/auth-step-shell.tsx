"use client";

import { useFocusOnMount } from "@auction/ui";
import type { WizardProgressStep } from "@auction/ui/components/wizard-progress";
import { WizardProgress } from "@auction/ui/components/wizard-progress";
import type { ReactNode } from "react";

export type AuthStepShellProps = {
  wizardSteps?: readonly WizardProgressStep[];
  currentStepIndex?: number;
  title: string;
  visuallyHiddenTitle?: boolean;
  children: ReactNode;
};

/** Shared auth wizard panel: optional progress, focus-managed heading, step body. */
export function AuthStepShell({
  wizardSteps,
  currentStepIndex = 0,
  title,
  visuallyHiddenTitle = false,
  children,
}: AuthStepShellProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  return (
    <div className="flex flex-col gap-10">
      {wizardSteps ? <WizardProgress steps={wizardSteps} currentIndex={currentStepIndex} /> : null}
      <h2
        ref={headingRef}
        tabIndex={-1}
        className={
          visuallyHiddenTitle
            ? "sr-only outline-none"
            : "font-label text-sm font-medium text-on-surface outline-none"
        }
      >
        {title}
      </h2>
      {children}
    </div>
  );
}
