import { ConnectWorkspace } from "@/components/connect/connect-workspace";
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
import { connectGapStageBadgeVariant, connectGapStageLabel } from "@/lib/connect/connect-gap-copy";
import {
  getServerStripeConnectClientConfig,
  syncServerStripeConnectStatus,
} from "@/lib/data/http/stripe-connect.server";
import {
  type ILegalEntityMemberListGateway,
  createLegalEntityMemberListGateway,
} from "@/lib/legal-entity/member-list.gateway.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { getConnectGapState, isSellerConnectReady } from "@auction/connect";
import { DisplayHeading, LabelCaps } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
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
  const gap = entity ? getConnectGapState(entity) : null;

  const [clientConfig, connectRes] = entity
    ? await Promise.all([getServerStripeConnectClientConfig(), syncServerStripeConnectStatus(id)])
    : [null, null];

  const showConnectBanner =
    clientConfig?.connectEnforced === true &&
    entity != null &&
    !isSellerConnectReady({ ...entity, status: entity.status });

  return (
    <div className="space-y-8">
      <SectionHeader
        kicker={<LabelCaps>Overview</LabelCaps>}
        heading={<DisplayHeading as="h2">At a glance</DisplayHeading>}
      />

      {showConnectBanner ? (
        <Alert>
          <AlertTitle>Payout setup incomplete</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>Finish Stripe Connect verification to receive settlement transfers.</span>
            <Button asChild variant="cta" size="sm">
              <Link href={`/dashboard/organisations/${id}/connect`}>Open payout setup</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

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
                id: "connect",
                label: "Payout setup",
                value: gap ? connectGapStageLabel(gap.stage) : "—",
                semanticTone:
                  gap?.stage === "ready" ? "emphasis" : reqDue > 0 ? "warning" : "default",
              },
              {
                id: "reqs",
                label: "Requirements",
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
        title="Payout setup"
        description="Manage bank details and Stripe requirements in-app."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/organisations/${id}/connect`} prefetch>
              Full-page view
            </Link>
          </Button>
        }
      >
        {entity && clientConfig && connectRes?.ok ? (
          <div className="space-y-4">
            {gap ? (
              <StatusBadge variant={connectGapStageBadgeVariant(gap.stage)} size="sm">
                {connectGapStageLabel(gap.stage)}
              </StatusBadge>
            ) : null}
            <ConnectWorkspace
              publishableKey={clientConfig.publishableKey}
              connectEnforced={clientConfig.connectEnforced}
              status={connectRes.data}
              syncDegraded={Boolean(connectRes.data.syncDegraded)}
              legalEntityId={id}
              memberRole={member.role}
              entityStatus={entity.status}
              kycApproved
              isLaxManaged={entity.isLaxManaged}
              returnPath={`/dashboard/organisations/${id}`}
            />
          </div>
        ) : entity && clientConfig && connectRes && !connectRes.ok ? (
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant">
              We could not refresh payout status from Stripe. Open the full payout setup page to try
              again.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/organisations/${id}/connect`}>Open payout setup</Link>
            </Button>
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
