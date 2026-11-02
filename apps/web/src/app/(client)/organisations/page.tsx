import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { OrgSubmittedAlert } from "@/components/dashboard/org-submitted-alert";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { DashboardSection } from "@/components/dashboard/primitives/dashboard-section";
import { InvitationCardList } from "@/components/organisations/invitation-card-list";
import { subkindLabel } from "@/components/organisations/labels";
import { OrgModuleComingSoon } from "@/components/organisations/org-module-coming-soon";
import { OrganisationCard } from "@/components/organisations/organisation-card";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import {
  type DashboardSliceFailure,
  buildDashboardSliceFailure,
  parseApiErrorCode,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { getOrgOnboardingResumeHrefForEntity } from "@/lib/data/http/org-onboarding.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { isOrgOnboardingInProgress } from "@/lib/legal-entity/org-onboarding-in-progress";
import { createOrganisationHubGateway } from "@/lib/legal-entity/organisation-hub.gateway.server";
import type { PendingInvitationRow } from "@/lib/legal-entity/pending-invitations.gateway.server";
import type { LegalEntity, LegalEntitySummary } from "@auction/types";
import { DisplayHeading } from "@auction/ui";
import { SectionHeader } from "@auction/ui/components/section-header";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";
import { Button } from "@auction/ui/lax";
import Link from "next/link";

type HubMembership = LegalEntitySummary;

export default async function OrganisationsHubPage() {
  const orgModuleEnabled = await resolveOrgModuleEnabledFromRequest();
  if (!orgModuleEnabled) {
    return (
      <DashboardListPage title="Organisations">
        <OrgModuleComingSoon />
      </DashboardListPage>
    );
  }

  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/organisations",
  });
  const { acting } = await resolveActingContext(user.role, user.staffRoles);

  let loadFailure: DashboardSliceFailure | null = null;
  let memberships: HubMembership[] = [];
  let pending: PendingInvitationRow[] = [];

  try {
    const res = await authedServerFetch("/legal-entities/me", { cache: "no-store" });
    if (!res.ok) {
      const code = await parseApiErrorCode(res);
      loadFailure = buildDashboardSliceFailure("legalEntities", res.status, code);
    } else {
      const body = (await res.json()) as { data: HubMembership[] };
      memberships = body.data ?? [];
    }

    if (!loadFailure) {
      const pendingRes = await authedServerFetch("/legal-entities/invitations/mine", {
        cache: "no-store",
      });
      if (pendingRes.ok) {
        const pendingBody = (await pendingRes.json()) as {
          data: typeof pending;
        };
        pending = pendingBody.data ?? [];
      }
    }
  } catch {
    loadFailure = buildDashboardSliceFailure("legalEntities", 500, null);
  }

  const hubGw = createOrganisationHubGateway();
  const orgs = memberships.filter((m) => m.kind === "organisation");
  const personal = memberships.find((m) => m.kind === "individual");

  const details = loadFailure
    ? []
    : await Promise.all(
        orgs.map(async (o) => ({
          summary: o,
          detail: await hubGw.getEntityDetail(o.id),
          resumeHref: isOrgOnboardingInProgress(o.status)
            ? await getOrgOnboardingResumeHrefForEntity(o.id)
            : null,
        })),
      );

  return (
    <DashboardListPage
      title="Your organisations"
      banner={orgModuleEnabled ? <OrgSubmittedAlert /> : null}
      description="Manage organisations you belong to, respond to invitations, and continue setup."
      actions={
        <Button asChild variant="primary" size="md">
          <Link href="/onboarding/organisation?fresh=1" prefetch>
            Register organisation
          </Link>
        </Button>
      }
      errorAlert={loadFailure ? <DashboardSliceErrorAlert failure={loadFailure} /> : null}
    >
      {!loadFailure && pending.length > 0 ? (
        <Surface variant="section" padding="md" className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-headline text-xl font-semibold tracking-tight text-on-surface">
              Pending invitations
            </h2>
            <p className="font-body text-sm text-on-surface-variant">
              Accept or decline before they expire.
            </p>
          </div>
          <InvitationCardList invitations={pending} />
        </Surface>
      ) : null}

      {!loadFailure && personal ? (
        <DashboardSection
          title="Personal account"
          description="Your individual profile used for bidding and receipts."
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-on-surface">{personal.displayName}</span>
            <StatusBadge tone="neutral">{subkindLabel(personal.subkind)}</StatusBadge>
          </div>
        </DashboardSection>
      ) : null}

      {!loadFailure && orgs.length === 0 ? (
        <DashboardEmptyState
          variant="hero"
          illustration="plinth"
          title={DASHBOARD_EMPTY.organisations.title}
          description={DASHBOARD_EMPTY.organisations.description}
          action={
            <Button asChild variant="primary" size="md">
              <Link href="/onboarding/organisation?fresh=1" prefetch>
                Register organisation
              </Link>
            </Button>
          }
        />
      ) : !loadFailure ? (
        <div className="space-y-4">
          <SectionHeader
            heading={<DisplayHeading as="h2">Your organisations</DisplayHeading>}
            action={
              <Button asChild variant="secondary" size="md">
                <Link href="/onboarding/organisation?fresh=1" prefetch>
                  Register organisation
                </Link>
              </Button>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {details.map(({ summary, detail, resumeHref }) => (
              <OrganisationCard
                key={summary.id}
                summary={{
                  id: summary.id,
                  displayName: summary.displayName,
                  subkind: summary.subkind,
                  status: summary.status,
                  role: summary.role,
                }}
                detail={detail as LegalEntity | null}
                isActing={acting?.id === summary.id}
                resumeHref={resumeHref}
              />
            ))}
          </div>
        </div>
      ) : null}
    </DashboardListPage>
  );
}
