import { connectGapStageBadgeVariant, connectGapStageLabel } from "@/lib/connect/connect-gap-copy";
import { orgOnboardingStepHref } from "@/lib/legal-entity/org-onboarding-resume";
import { organisationHref } from "@/lib/navigation/client-routes";
import { organisationRoleLabel } from "@/lib/presenters/organisation-role/organisation-role-presentation";
import { organisationStatusView } from "@/lib/presenters/organisation-status/organisation-status-presentation";
import { getConnectGapState } from "@auction/connect";
import type { LegalEntity, LegalEntitySubkind } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Card, CardContent, CardFooter, CardHeader } from "@auction/ui/components/card";
import { StatusBadge } from "@auction/ui/components/status-badge";
import Link from "next/link";
import { initials } from "./initials";
import { subkindLabel } from "./labels";
import { resumeOnboardingStepKey } from "./org-onboarding-step-map";

export type OrganisationCardProps = {
  summary: {
    id: string;
    displayName: string;
    subkind: LegalEntitySubkind | string;
    status: LegalEntity["status"];
    role: string;
  };
  detail?: LegalEntity | null;
  isActing: boolean;
  /** When set, overrides status-based resume step (from onboarding API). */
  resumeHref?: string | null;
};

export function OrganisationCard({
  summary,
  detail,
  isActing,
  resumeHref: resumeHrefProp,
}: OrganisationCardProps) {
  const gap = detail ? getConnectGapState(detail) : null;
  const status = organisationStatusView(summary.status);
  const fallbackStep = resumeOnboardingStepKey(summary.status);
  const fallbackHref = fallbackStep
    ? orgOnboardingStepHref(fallbackStep, { entityId: summary.id })
    : null;
  const resumeHref = resumeHrefProp ?? fallbackHref;
  const showResume = fallbackStep !== null;

  return (
    <Card className="transition-shadow hover:ring-1 hover:ring-primary/20">
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-semibold text-on-primary-container">
          {initials(summary.displayName)}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-headline text-lg font-semibold tracking-tight">
              {summary.displayName}
            </h3>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </div>
          <p className="text-sm text-on-surface-variant">
            {subkindLabel(summary.subkind)} · {organisationRoleLabel(summary.role)}
          </p>
        </div>
      </CardHeader>
      {gap ? (
        <CardContent className="space-y-2 pb-4 pt-0">
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge tone={connectGapStageBadgeVariant(gap.stage)}>
              {connectGapStageLabel(gap.stage)}
            </StatusBadge>
            {gap.missing.length > 0 ? (
              <StatusBadge tone="warning">
                {gap.missing.length} {gap.missing.length === 1 ? "detail" : "details"} needed
              </StatusBadge>
            ) : null}
          </div>
        </CardContent>
      ) : null}
      <CardFooter className="flex flex-wrap gap-2 border-t border-border-hairline pt-4">
        {!isActing ? (
          <Button asChild size="default" variant="secondary">
            <Link href={organisationHref("profile", summary.id)} prefetch>
              Manage
            </Link>
          </Button>
        ) : (
          <StatusBadge tone="info">Active</StatusBadge>
        )}
        {showResume && resumeHref ? (
          <Button asChild size="default" variant="outline">
            <Link href={resumeHref} prefetch>
              {summary.status === "connect_pending" ? "Finish payout setup" : "Continue setup"}
            </Link>
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
