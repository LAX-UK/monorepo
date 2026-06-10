import { orgOnboardingSidebarSections } from "@/lib/legal-entity/org-onboarding-sidebar-copy";
import { ORG_ONBOARDING_STEP_META } from "@/lib/legal-entity/org-onboarding-steps";
import type { OrgOnboardingStepKey } from "@auction/types";
import { cn } from "@auction/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import type { PublicOrganisationSubkind } from "@auction/validators";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

type Props = {
  activeStepKey: OrgOnboardingStepKey | null;
  subkind: PublicOrganisationSubkind | null;
  completedSteps: readonly OrgOnboardingStepKey[];
  className?: string;
};

export function OrgOnboardingSidebar({ activeStepKey, subkind, completedSteps, className }: Props) {
  const completed = new Set(completedSteps);
  const sections = orgOnboardingSidebarSections(subkind);
  const totalMinutes = ORG_ONBOARDING_STEP_META.reduce(
    (sum, step) => sum + (step.estimatedMinutes ?? 0),
    0,
  );

  return (
    <Card className={cn("h-fit", className)}>
      <CardHeader>
        <CardTitle className="font-label text-xs font-bold uppercase tracking-[0.18em]">
          What you&apos;ll need
        </CardTitle>
        <CardDescription className="text-on-surface-variant">
          Have these ready for a smoother setup
          {totalMinutes > 0 ? ` (~${totalMinutes} minutes total)` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm text-on-surface-variant">
        {sections.map((section) => {
          const isActive = section.stepKey === activeStepKey;
          const isDone = completed.has(section.stepKey);
          const stepLabel =
            ORG_ONBOARDING_STEP_META.find((step) => step.key === section.stepKey)?.label ??
            section.title;

          return (
            <section
              key={section.stepKey}
              aria-labelledby={`org-sidebar-${section.stepKey}`}
              className={cn(
                "rounded-lg border px-3 py-3 transition-colors",
                isActive
                  ? "border-primary/40 bg-primary/5"
                  : "border-outline-variant/30 bg-transparent",
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                {isDone ? (
                  <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                ) : (
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      isActive ? "bg-primary" : "bg-outline-variant/60",
                    )}
                    aria-hidden
                  />
                )}
                <h3
                  id={`org-sidebar-${section.stepKey}`}
                  className={cn(
                    "font-label text-[11px] font-bold uppercase tracking-wide",
                    isActive ? "text-on-surface" : "text-on-surface-variant",
                  )}
                >
                  {stepLabel}
                </h3>
              </div>
              <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          );
        })}
        <p className="text-xs leading-relaxed">
          Progress is saved to your account. Continue from{" "}
          <Link
            href="/dashboard/organisations"
            className="font-semibold text-primary hover:underline"
          >
            Organisations
          </Link>{" "}
          in the dashboard.
        </p>
      </CardContent>
    </Card>
  );
}
