import { ContactDetailsCard } from "@/components/organisation-team/contact-details-card";
import { InvoiceDetailsCard } from "@/components/organisation-team/invoice-details-card";
import { LeaveOrCloseCard } from "@/components/organisation-team/leave-or-close-card";
import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
} from "@/components/organisation-team/settings-section";
import { WorkspaceTabNoAccess } from "@/components/organisation-team/workspace-tab-no-access";
import { subkindLabel } from "@/components/organisations/labels";
import { resumeOnboardingStepKey } from "@/components/organisations/org-onboarding-step-map";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getOrgOnboardingResumeHrefForEntity } from "@/lib/data/http/org-onboarding.server";
import { getServerContactDetails } from "@/lib/data/http/organisation-profile.server";
import { getServerInvoiceDetails } from "@/lib/data/http/organisation-team.server";
import { leaveControl } from "@/lib/legal-entity/member-controls.vm";
import { ORG_ONBOARDING_TIMELINE_STAGES } from "@/lib/legal-entity/org-onboarding-steps";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { requireOrganisationTab } from "@/lib/navigation/organisation-tabs";
import {
  loadTeamMembers,
  loadTeamScope,
  memberChangeActorFor,
} from "@/lib/organisation-team/team-data.server";
import { entityActorCan } from "@auction/domain";
import type { LegalEntityStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
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

/**
 * The Profile tab: setup or review progress while it is unfinished, the checked details (changed
 * through the secure setup flow, since a change is checked again), the contact and invoice
 * details edited in place, and leaving or closing. Finance opens it for the invoice details only.
 */
export default async function OrganisationProfilePage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: CLIENT_ROUTES.organisation,
  });
  const scope = await loadTeamScope(user);
  if (!scope) return null;
  const { acting, actor } = scope;
  const access = requireOrganisationTab(actor, "profile");
  if (access.kind === "forbidden") {
    // The Organisation page opens on the first tab the person can use.
    if (access.fallback) redirect(access.fallback.href);
    return (
      <WorkspaceTabNoAccess
        access={access}
        legalEntityId={acting.id}
        actor={actor}
        userId={user.id}
      />
    );
  }

  const readsDetails = entityActorCan(actor, "entity.profile.read");
  const [ctx, contactDetails, invoiceDetails, members] = await Promise.all([
    createPerOrgGateway().getContext(acting.id),
    entityActorCan(actor, "entity.contact.read")
      ? getServerContactDetails(acting.id).catch(() => null)
      : null,
    getServerInvoiceDetails(acting.id).catch(() => null),
    entityActorCan(actor, "entity.members.read") ? loadTeamMembers(scope) : null,
  ]);
  if (!ctx) notFound();
  const { member, entity } = ctx;
  const id = member.id;
  const status = entity?.status ?? member.status;
  const name = member.displayName;

  const resumeStep = readsDetails ? resumeOnboardingStepKey(status) : null;
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
  const reviewIndex = readsDetails ? (REVIEW_INDEX[status] ?? -1) : -1;
  const changeHref = `/onboarding/organisation/step/details?entityId=${encodeURIComponent(id)}&returnTo=${encodeURIComponent(CLIENT_ROUTES.organisation)}`;

  // Members who can't see the team can't be its last owner, so leaving is always theirs to do.
  const leave = actor.isImpersonation
    ? null
    : members?.ok
      ? leaveControl(memberChangeActorFor(scope, user.id, members.data), members.data)
      : ({ allowed: true } as const);

  return (
    <div className="flex max-w-[960px] flex-col gap-8">
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

      {readsDetails ? (
        <SettingsSection
          id="details-heading"
          title="Details"
          description="What we checked. Changing these means we check them again, and bidding can pause until we have."
        >
          <SettingsCard>
            <SettingsRow
              label="Legal name"
              value={entity?.legalName?.trim() || "Not given"}
              muted={!entity?.legalName?.trim()}
            />
            <SettingsRow label="Trading name" value={name} />
            <SettingsRow label="Type" value={subkindLabel(member.subkind)} />
            <SettingsRow
              label="VAT number"
              value={entity?.vatNumber?.trim() || "Not given"}
              muted={!entity?.vatNumber?.trim()}
            />
            {actor.isImpersonation ? null : (
              <div className="px-4 py-3 md:px-5">
                <Link
                  href={changeHref}
                  className="lax-focus rounded-lax-badge text-lax-14 font-medium text-lax-fg underline decoration-lax-line-strong underline-offset-4 hover:decoration-current"
                >
                  Change these details
                </Link>
              </div>
            )}
          </SettingsCard>
        </SettingsSection>
      ) : null}

      {contactDetails ? (
        <SettingsSection
          id="contact-heading"
          title="Contact"
          description={
            contactDetails.canEdit
              ? `How buyers and our team reach ${name}. Saved straight away.`
              : `How buyers and our team reach ${name}. Owners and admins change these.`
          }
        >
          <ContactDetailsCard legalEntityId={id} details={contactDetails} />
        </SettingsSection>
      ) : null}

      {invoiceDetails ? (
        <SettingsSection
          id="invoice-details-heading"
          title="Invoice details"
          description={`Printed on invoices for lots ${name} wins. Saved straight away.`}
        >
          <InvoiceDetailsCard legalEntityId={id} details={invoiceDetails} />
        </SettingsSection>
      ) : null}

      {leave ? (
        <SettingsSection
          id="leave-heading"
          title="Leave or close"
          description="These can't be undone from here."
        >
          <LeaveOrCloseCard
            legalEntityId={id}
            organisationName={name}
            leave={leave}
            canClose={entityActorCan(actor, "entity.ownership.manage")}
          />
        </SettingsSection>
      ) : null}
    </div>
  );
}
