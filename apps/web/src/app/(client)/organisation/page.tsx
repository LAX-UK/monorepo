import { subkindLabel } from "@/components/organisations/labels";
import { resumeOnboardingStepKey } from "@/components/organisations/org-onboarding-step-map";
import { OrgTabSectionHeader } from "@/components/organisations/org-tab-section-header";
import { OrganisationTabNoAccess } from "@/components/organisations/organisation-tab-no-access";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getOrgOnboardingResumeHrefForEntity } from "@/lib/data/http/org-onboarding.server";
import { resolveActiveOrganisationActor } from "@/lib/legal-entity/active-organisation.server";
import { ORG_ONBOARDING_TIMELINE_STAGES } from "@/lib/legal-entity/org-onboarding-steps";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { requireOrganisationTab } from "@/lib/navigation/organisation-tabs";
import type { LegalEntityStatus } from "@auction/types";
import { DisplayHeading } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { SectionHeader } from "@auction/ui/components/section-header";
import { Surface } from "@auction/ui/components/surface";
import { TimelineStages } from "@auction/ui/components/timeline-stages";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const REVIEW_TIMELINE = [
  { id: "submitted", label: "Submitted" },
  { id: "review", label: "Under review" },
  { id: "connect", label: "Payout setup" },
  { id: "approved", label: "Approved" },
] as const;

/** Where an organisation that has finished its own setup is in LAX's review. */
const REVIEW_INDEX: Partial<Record<LegalEntityStatus, number>> = {
  docs_received: 0,
  under_review: 1,
  connect_pending: 2,
};

/** The Profile tab: setup or review progress while it is unfinished, then the registered details. */
export default async function OrganisationProfilePage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: CLIENT_ROUTES.organisation,
  });
  const active = await resolveActiveOrganisationActor(user);
  if (!active) return null;
  const access = requireOrganisationTab(active.actor, "profile");
  if (access.kind === "forbidden") {
    // The Organisation page opens on the first tab the person can use (finance: Payouts).
    if (access.fallback) redirect(access.fallback.href);
    return <OrganisationTabNoAccess access={access} />;
  }

  const ctx = await createPerOrgGateway().getContext(active.organisation.id);
  if (!ctx) notFound();
  const { member, entity } = ctx;
  const id = member.id;
  const status = entity?.status ?? member.status;

  const resumeStep = resumeOnboardingStepKey(status);
  const continueSetupHref = resumeStep
    ? ((await getOrgOnboardingResumeHrefForEntity(id)) ??
      `/onboarding/organisation/step/${resumeStep}?entityId=${encodeURIComponent(id)}`)
    : null;
  const timelineIndex = resumeStep
    ? Math.max(
        0,
        ORG_ONBOARDING_TIMELINE_STAGES.findIndex((stage) => stage.id === resumeStep),
      )
    : -1;
  const reviewIndex = REVIEW_INDEX[status] ?? -1;

  const editHref = `/onboarding/organisation/step/details?entityId=${encodeURIComponent(id)}&returnTo=${encodeURIComponent(CLIENT_ROUTES.organisation)}`;
  const details: { label: string; value: string }[] = [
    { label: "Display name", value: member.displayName },
    { label: "Type", value: subkindLabel(member.subkind) },
    { label: "Legal name", value: entity?.legalName?.trim() || "Not given" },
    { label: "VAT number", value: entity?.vatNumber?.trim() || "Not given" },
  ];

  return (
    <div className="space-y-6">
      {resumeStep && continueSetupHref ? (
        <Surface variant="section" padding="md" className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-headline text-lg font-semibold tracking-tight text-on-surface">
              Continue organisation setup
            </h2>
            <p className="font-body text-sm text-on-surface-variant">
              Pick up where you left off. Your progress is saved.
            </p>
          </div>
          <TimelineStages stages={ORG_ONBOARDING_TIMELINE_STAGES} activeIndex={timelineIndex} />
          <Button asChild variant="primary" size="default">
            <Link href={continueSetupHref} prefetch>
              Continue setup
            </Link>
          </Button>
        </Surface>
      ) : reviewIndex >= 0 ? (
        <Surface variant="section" padding="md" className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-headline text-lg font-semibold tracking-tight text-on-surface">
              Application status
            </h2>
            <p className="font-body text-sm text-on-surface-variant">
              Where your organisation is in our review.
            </p>
          </div>
          <TimelineStages stages={REVIEW_TIMELINE} activeIndex={reviewIndex} />
        </Surface>
      ) : null}

      <OrgTabSectionHeader>
        <SectionHeader heading={<DisplayHeading as="h2">Profile</DisplayHeading>} />
      </OrgTabSectionHeader>

      <Surface variant="section" padding="md" className="space-y-5">
        <p className="font-body text-sm text-on-surface-variant">
          Trading name, legal name, VAT number and address are changed in the secure setup flow.
        </p>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {details.map((row) => (
            <div key={row.label}>
              <dt className="font-body text-xs text-on-surface-variant">{row.label}</dt>
              <dd className="mt-1 break-words font-body text-sm font-medium text-on-surface">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        <Button asChild variant="secondary" size="default">
          <Link href={editHref} prefetch>
            Edit profile
          </Link>
        </Button>
      </Surface>
    </div>
  );
}
