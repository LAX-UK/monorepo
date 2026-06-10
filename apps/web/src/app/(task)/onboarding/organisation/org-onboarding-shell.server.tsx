import { OrgOnboardingShell } from "@/app/(task)/onboarding/organisation/org-onboarding-shell";
import { resolveOrgOnboardingLayoutContext } from "@/lib/legal-entity/org-onboarding-layout-context.server";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export async function OrgOnboardingShellServer({ children }: Props) {
  const ctx = await resolveOrgOnboardingLayoutContext();

  return (
    <OrgOnboardingShell
      initialEntityId={ctx.entityId}
      initialFresh={ctx.fresh}
      initialDisplayName={ctx.displayName}
      initialCompletedSteps={ctx.completedSteps}
      initialSubkind={ctx.subkind}
      initialStepKey={ctx.currentStepKey}
    >
      {children}
    </OrgOnboardingShell>
  );
}
