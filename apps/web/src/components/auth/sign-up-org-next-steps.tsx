import {
  ORG_ONBOARDING_STEP_META,
  ORG_ONBOARDING_TIMELINE_STAGES,
} from "@/lib/legal-entity/org-onboarding-steps";
import { cn } from "@auction/ui";
import { Surface } from "@auction/ui/components/surface";
import { TimelineStages } from "@auction/ui/components/timeline-stages";

const ORG_ONBOARDING_TOTAL_MINUTES = ORG_ONBOARDING_STEP_META.reduce(
  (sum, step) => sum + (step.estimatedMinutes ?? 0),
  0,
);

export type SignUpOrgNextStepsProps = {
  className?: string;
};

/** Informational preview of org onboarding steps shown during organisation signup. */
export function SignUpOrgNextSteps({ className }: SignUpOrgNextStepsProps) {
  const durationClause =
    ORG_ONBOARDING_TOTAL_MINUTES > 0 ? `, about ${ORG_ONBOARDING_TOTAL_MINUTES} minutes` : "";

  return (
    <Surface
      variant="quiet"
      padding="sm"
      className={cn("border border-outline-variant/40", className)}
      data-testid="sign-up-org-next-steps"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-label text-sm font-medium text-on-surface">
            After you verify your email
          </h3>
          <p className="font-body text-sm text-on-surface-variant">
            Set up your organisation to sell and consign{durationClause}. Your progress saves
            automatically, so you can finish anytime.
          </p>
        </div>
        <TimelineStages stages={ORG_ONBOARDING_TIMELINE_STAGES} activeIndex={-1} />
      </div>
    </Surface>
  );
}
