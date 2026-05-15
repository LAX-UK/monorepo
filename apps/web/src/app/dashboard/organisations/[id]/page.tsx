import { DashboardSection } from "@/components/dashboard/primitives/dashboard-section";
import { statusLabel } from "@/components/organisations/labels";
import { MembersAvatarStack } from "@/components/organisations/members-avatar-stack";
import { resumeOnboardingStepKey } from "@/components/organisations/org-onboarding-step-map";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import {
  type ILegalEntityMemberListGateway,
  createLegalEntityMemberListGateway,
} from "@/lib/legal-entity/member-list.gateway.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { DisplayHeading, LabelCaps } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { KpiTile } from "@auction/ui/components/kpi-tile";
import { SectionHeader } from "@auction/ui/components/section-header";
import { StatStrip } from "@auction/ui/components/stat-strip";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { TimelineStages } from "@auction/ui/components/timeline-stages";
import Link from "next/link";
import { notFound } from "next/navigation";

const ONBOARD_TIMELINE = [
  { id: "type", label: "Type" },
  { id: "details", label: "Details" },
  { id: "documents", label: "Documents" },
  { id: "connect", label: "Connect" },
  { id: "identity", label: "Identity" },
] as const;

export default async function OrganisationOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAuthenticatedUser({
    shell: "client",
    loginNext: `/dashboard/organisations/${id}`,
  });
  const perOrgGw = createPerOrgGateway();
  const ctx = await perOrgGw.getContext(id);
  if (!ctx) notFound();

  const { member, entity } = ctx;
  const status = entity?.status ?? member.status;
  const resumeStep = resumeOnboardingStepKey(status);
  const timelineIndex = resumeStep
    ? Math.max(
        0,
        ONBOARD_TIMELINE.findIndex((s) => s.id === resumeStep),
      )
    : -1;

  const memberListGateway: ILegalEntityMemberListGateway = createLegalEntityMemberListGateway();
  const fetched = await memberListGateway.fetchMemberListForActing(member);
  const memberAvatars =
    fetched.ok && fetched.data.length > 0
      ? fetched.data.map((m) => ({ name: m.user.name, image: m.user.image }))
      : [];
  const memberCount = fetched.ok ? fetched.data.length : 0;

  const reqDue = entity?.stripeConnectRequirementsCurrentlyDue?.length ?? 0;
  const reqs = entity?.stripeConnectRequirementsCurrentlyDue ?? [];

  return (
    <div className="space-y-8">
      <SectionHeader
        kicker={<LabelCaps>Overview</LabelCaps>}
        heading={<DisplayHeading as="h2">At a glance</DisplayHeading>}
      />

      <StatStrip>
        <KpiTile label="Status" value={statusLabel(status)} emphasize />
        <KpiTile label="Members" value={String(memberCount)} />
        <KpiTile
          label="Stripe charges"
          value={entity ? (entity.stripeConnectChargesEnabled ? "On" : "Off") : "—"}
        />
        <KpiTile
          label="Stripe payouts"
          value={entity ? (entity.stripeConnectPayoutsEnabled ? "On" : "Off") : "—"}
        />
        <KpiTile label="Connect reqs" value={String(reqDue)} />
      </StatStrip>

      {resumeStep ? (
        <Card className="border-l-4 border-l-primary shadow-lg">
          <CardHeader>
            <LabelCaps>Needs attention</LabelCaps>
            <CardTitle className="font-headline text-xl tracking-tight">
              Continue organisation setup
            </CardTitle>
            <CardDescription>
              Pick up where you left off — progress is saved to your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TimelineStages stages={ONBOARD_TIMELINE} activeIndex={timelineIndex} />
            <Button asChild variant="cta" size="sm">
              <Link
                href={`/onboarding/organisation/step/${resumeStep}?entityId=${encodeURIComponent(id)}`}
                prefetch
              >
                Continue setup
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg tracking-tight">Onboarding</CardTitle>
            <CardDescription>
              No open setup steps for this status. You can still open the flow to review or update
              information.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/onboarding/organisation/step/type?entityId=${encodeURIComponent(id)}`}
                prefetch
              >
                Open onboarding
              </Link>
            </Button>
          </CardFooter>
        </Card>
      )}

      <DashboardSection
        title="Members"
        description="People who can act for this organisation."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href={`/dashboard/organisations/${id}/members`} prefetch>
              Manage members
            </Link>
          </Button>
        }
      >
        {memberAvatars.length > 0 ? (
          <MembersAvatarStack members={memberAvatars} max={8} />
        ) : (
          <p className="text-sm text-on-surface-variant">No team members loaded yet.</p>
        )}
      </DashboardSection>

      <DashboardSection
        title="Stripe Connect"
        description="Payout readiness for this organisation."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/organisations/${id}/connect`} prefetch>
              Open Connect
            </Link>
          </Button>
        }
      >
        {entity ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <StatusBadge
                variant={entity.stripeConnectChargesEnabled ? "success" : "neutral"}
                size="sm"
              >
                Charges {entity.stripeConnectChargesEnabled ? "on" : "off"}
              </StatusBadge>
              <StatusBadge
                variant={entity.stripeConnectPayoutsEnabled ? "success" : "neutral"}
                size="sm"
              >
                Payouts {entity.stripeConnectPayoutsEnabled ? "on" : "off"}
              </StatusBadge>
              {reqDue > 0 ? (
                <StatusBadge variant="warning" size="sm">
                  {reqDue} requirement{reqDue === 1 ? "" : "s"} due
                </StatusBadge>
              ) : null}
            </div>
            {reqs.length > 0 ? (
              <ul className="list-inside list-disc space-y-1 text-sm text-on-surface-variant">
                {reqs.slice(0, 8).map((r) => (
                  <li key={r} className="font-mono text-xs">
                    {r}
                  </li>
                ))}
                {reqs.length > 8 ? (
                  <li className="list-none text-xs">+{reqs.length - 8} more in Stripe</li>
                ) : null}
              </ul>
            ) : (
              <p className="text-sm text-on-surface-variant">
                No outstanding Connect requirements.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">
            Connect details will load once available.
          </p>
        )}
      </DashboardSection>
    </div>
  );
}
