import { DashboardSection } from "@/components/dashboard/primitives/dashboard-section";
import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import { SplitDetailLayout } from "@/components/dashboard/primitives/split-detail-layout";
import {
  roleLabel,
  statusBadgeVariant,
  statusLabel,
  subkindLabel,
} from "@/components/organisations/labels";
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
import { SectionHeader } from "@auction/ui/components/section-header";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";
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

      <SplitDetailLayout
        mediaSlot={
          <Surface
            variant="section"
            padding="lg"
            className="flex min-h-[200px] flex-col justify-end bg-gradient-to-br from-primary/20 via-lot-orange/10 to-surface-container-high"
          >
            <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
              {entity?.displayName ? "Organisation" : "Member"}
            </p>
            <h2 className="font-headline text-2xl font-semibold tracking-tight text-on-surface">
              {entity?.displayName ?? member.displayName ?? "Organisation"}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge variant={statusBadgeVariant(status)}>{statusLabel(status)}</StatusBadge>
              <StatusBadge variant="neutral">{roleLabel(member.role)}</StatusBadge>
              {entity?.subkind ? (
                <StatusBadge variant="neutral">{subkindLabel(entity.subkind)}</StatusBadge>
              ) : null}
            </div>
          </Surface>
        }
        metaSlot={
          <KpiRow
            columns={4}
            className="xl:grid-cols-2 [&_section]:shadow-none"
            tiles={[
              {
                id: "status",
                label: "Status",
                value: statusLabel(status),
                semanticTone: "emphasis",
                emphasize: true,
              },
              { id: "members", label: "Members", value: String(memberCount) },
              {
                id: "charges",
                label: "Stripe charges",
                value: entity ? (entity.stripeConnectChargesEnabled ? "On" : "Off") : "—",
              },
              {
                id: "payouts",
                label: "Stripe payouts",
                value: entity ? (entity.stripeConnectPayoutsEnabled ? "On" : "Off") : "—",
              },
              {
                id: "reqs",
                label: "Connect reqs",
                value: String(reqDue),
                semanticTone: reqDue > 0 ? "warning" : "default",
              },
            ]}
          />
        }
      />

      {resumeStep ? (
        <Surface variant="section" padding="md" className="space-y-4 border-l-4 border-l-primary">
          <div className="space-y-1">
            <LabelCaps>Needs attention</LabelCaps>
            <h3 className="font-headline text-xl font-semibold tracking-tight text-on-surface">
              Continue organisation setup
            </h3>
            <p className="font-body text-sm text-on-surface-variant">
              Pick up where you left off — progress is saved to your account.
            </p>
          </div>
          <TimelineStages stages={ONBOARD_TIMELINE} activeIndex={timelineIndex} />
          <Button asChild variant="cta" size="sm">
            <Link
              href={`/onboarding/organisation/step/${resumeStep}?entityId=${encodeURIComponent(id)}`}
              prefetch
            >
              Continue setup
            </Link>
          </Button>
        </Surface>
      ) : (
        <Surface variant="section" padding="md" className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-headline text-lg font-semibold tracking-tight text-on-surface">
              Onboarding
            </h3>
            <p className="font-body text-sm text-on-surface-variant">
              No open setup steps for this status. You can still open the flow to review or update
              information.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/onboarding/organisation/step/type?entityId=${encodeURIComponent(id)}`}
              prefetch
            >
              Open onboarding
            </Link>
          </Button>
        </Surface>
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
