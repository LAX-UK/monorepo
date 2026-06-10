"use client";

import { OrgOnboardingSidebar } from "@/components/onboarding/org-onboarding-sidebar";
import { WIZARD_COPY } from "@/lib/forms/wizard-copy";
import {
  lastCompletedOrgOnboardingStepIndex,
  orgOnboardingStepHref,
} from "@/lib/legal-entity/org-onboarding-resume";
import {
  ORG_ONBOARDING_STEP_META,
  orgOnboardingStepIndex,
  orgOnboardingStepKeyFromPathname,
} from "@/lib/legal-entity/org-onboarding-steps";
import type { OrgOnboardingStepKey } from "@auction/types";
import { LabelCaps } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { WizardProgress } from "@auction/ui/components/wizard-progress";
import type { PublicOrganisationSubkind } from "@auction/validators";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo } from "react";

type Props = {
  children: ReactNode;
  initialEntityId: string | null;
  initialFresh: boolean;
  initialDisplayName: string | null;
  initialCompletedSteps: OrgOnboardingStepKey[];
  initialSubkind: PublicOrganisationSubkind | null;
  initialStepKey: OrgOnboardingStepKey | null;
};

export function OrgOnboardingShell({
  children,
  initialEntityId,
  initialFresh,
  initialDisplayName,
  initialCompletedSteps,
  initialSubkind,
  initialStepKey,
}: Props) {
  const searchParams = useSearchParams();
  const fresh = searchParams.get("fresh") === "1" || initialFresh;
  const entityId = fresh ? null : (searchParams.get("entityId") ?? initialEntityId);
  const queryOpts = useMemo(
    () => ({
      ...(entityId ? { entityId } : {}),
      ...(fresh ? { fresh: true } : {}),
    }),
    [entityId, fresh],
  );

  const pathname = usePathname();
  const router = useRouter();
  const stepKey =
    orgOnboardingStepKeyFromPathname(pathname) ??
    initialStepKey ??
    ORG_ONBOARDING_STEP_META[0]?.key ??
    "type";
  const activeIndex = Math.max(0, orgOnboardingStepIndex(stepKey));

  const completedSteps = entityId ? initialCompletedSteps : [];
  const orgLabel = entityId ? initialDisplayName : null;
  const subkind = entityId ? initialSubkind : null;

  const maxReachableIndex = Math.max(
    activeIndex,
    lastCompletedOrgOnboardingStepIndex(completedSteps),
  );

  const wizardSteps = ORG_ONBOARDING_STEP_META.map((step) => ({
    id: step.key,
    label: step.label,
    ...(step.estimatedMinutes != null ? { estimatedMinutes: step.estimatedMinutes } : {}),
  }));

  const onStepClick = (index: number) => {
    const step = ORG_ONBOARDING_STEP_META[index];
    if (!step) return;
    router.push(orgOnboardingStepHref(step.key, queryOpts));
  };

  const focusStepHeading = (panel: HTMLDivElement | null) => {
    const heading = panel?.querySelector("h2");
    if (heading instanceof HTMLElement) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-4 border-b border-outline-variant/30 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-1">
            <LabelCaps>Organisation onboarding</LabelCaps>
            <p className="font-label text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
              {orgLabel ? (
                <span className="text-on-surface">{orgLabel}</span>
              ) : entityId ? (
                <span className="text-on-surface-variant">Loading…</span>
              ) : (
                <span className="text-on-surface">New organisation</span>
              )}
            </p>
          </div>
          <div className="lg:hidden">
            <WizardProgress
              steps={wizardSteps}
              currentIndex={activeIndex}
              maxReachableIndex={maxReachableIndex}
              completedStepIds={completedSteps}
              variant="bar"
              enableMobileSheet
              onStepClick={onStepClick}
              sidebarContent={
                <OrgOnboardingSidebar
                  activeStepKey={stepKey}
                  subkind={subkind}
                  completedSteps={completedSteps}
                  className="border-0 bg-transparent shadow-none"
                />
              }
            />
          </div>
          <div className="hidden lg:block">
            <WizardProgress
              steps={wizardSteps}
              currentIndex={activeIndex}
              maxReachableIndex={maxReachableIndex}
              completedStepIds={completedSteps}
              variant="chips"
              onStepClick={onStepClick}
            />
          </div>
        </div>
        <Button asChild variant="ghost" size="sm" className="shrink-0 self-start sm:self-auto">
          <Link href="/dashboard/organisations">{WIZARD_COPY.finishLater}</Link>
        </Button>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <OrgOnboardingSidebar
          activeStepKey={stepKey}
          subkind={subkind}
          completedSteps={completedSteps}
          className="order-first lg:order-none lg:col-start-2 lg:row-start-1 hidden lg:block"
        />
        <div key={stepKey} ref={focusStepHeading} className="lg:col-start-1 lg:row-start-1">
          {children}
        </div>
      </div>
    </div>
  );
}
