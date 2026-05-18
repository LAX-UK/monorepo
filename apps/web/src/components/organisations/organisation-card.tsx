import type { LegalEntity, LegalEntitySubkind } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Card, CardContent, CardFooter, CardHeader } from "@auction/ui/components/card";
import { StatusBadge } from "@auction/ui/components/status-badge";
import Link from "next/link";
import { initials } from "./initials";
import { roleLabel, statusBadgeVariant, statusLabel, subkindLabel } from "./labels";

export type OrganisationCardProps = {
  summary: {
    id: string;
    displayName: string;
    subkind: LegalEntitySubkind | string;
    status: LegalEntity["status"];
    role: string;
    isPrimaryAdmin: boolean;
  };
  detail?: LegalEntity | null;
  isActing: boolean;
};

export function OrganisationCard({ summary, detail, isActing }: OrganisationCardProps) {
  const reqDue = detail?.stripeConnectRequirementsCurrentlyDue?.length ?? 0;
  const resumeHref = `/onboarding/organisation/step/type?entityId=${encodeURIComponent(summary.id)}`;
  const showResume =
    summary.status === "lead" ||
    summary.status === "docs_requested" ||
    summary.status === "docs_received";

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
            <StatusBadge variant={statusBadgeVariant(summary.status)} size="sm">
              {statusLabel(summary.status)}
            </StatusBadge>
          </div>
          <p className="text-sm text-on-surface-variant">
            {subkindLabel(summary.subkind)} · {roleLabel(summary.role)}
            {summary.isPrimaryAdmin ? " · Primary admin" : ""}
          </p>
        </div>
      </CardHeader>
      {detail ? (
        <CardContent className="space-y-2 pb-4 pt-0">
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge
              variant={detail.stripeConnectChargesEnabled ? "success" : "neutral"}
              size="sm"
            >
              Charges {detail.stripeConnectChargesEnabled ? "on" : "off"}
            </StatusBadge>
            <StatusBadge
              variant={detail.stripeConnectPayoutsEnabled ? "success" : "neutral"}
              size="sm"
            >
              Payouts {detail.stripeConnectPayoutsEnabled ? "on" : "off"}
            </StatusBadge>
            {reqDue > 0 ? (
              <StatusBadge variant="warning" size="sm">
                {reqDue} Connect req{reqDue === 1 ? "" : "s"}
              </StatusBadge>
            ) : null}
          </div>
        </CardContent>
      ) : null}
      <CardFooter className="flex flex-wrap gap-2 border-t border-border-hairline pt-4">
        {!isActing ? (
          <Button asChild size="sm" variant="secondary">
            <Link href={`/dashboard/organisations/${summary.id}`} prefetch>
              Manage
            </Link>
          </Button>
        ) : (
          <StatusBadge variant="info" size="sm">
            Active
          </StatusBadge>
        )}
        {showResume ? (
          <Button asChild size="sm" variant="outline">
            <Link href={resumeHref} prefetch>
              Continue setup
            </Link>
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
