import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
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
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { createOrganisationHubGateway } from "@/lib/legal-entity/organisation-hub.gateway.server";
import type { PendingInvitationRow } from "@/lib/legal-entity/pending-invitations.gateway.server";
import type { LegalEntity, LegalEntitySummary } from "@auction/types";
import { DisplayHeading, LabelCaps } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { SectionHeader } from "@auction/ui/components/section-header";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";
import { Building2 } from "lucide-react";
import Link from "next/link";

type HubMembership = LegalEntitySummary;

export default async function OrganisationsHubPage() {
  const orgModuleEnabled = await resolveOrgModuleEnabledFromRequest();
  if (!orgModuleEnabled) {
    return (
      <DashboardPage>
        <OrgModuleComingSoon />
      </DashboardPage>
    );
  }

  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/organisations",
  });
  const { acting } = await resolveActingContext(user.role, user.staffRole ?? null);

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
        })),
      );

  return (
    <DashboardPage>
      <div className="mx-auto max-w-5xl">
        <DashboardPageHeader
          meta="Workspaces"
          title="Organisations"
          hideTitleOnMobile
          hideDescriptionOnMobile
          description="Manage organisations you belong to, respond to invitations, and continue setup."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/onboarding/organisation?fresh=1" prefetch>
                Register organisation
              </Link>
            </Button>
          }
        />

        {loadFailure ? <DashboardSliceErrorAlert failure={loadFailure} /> : null}

        {!loadFailure && pending.length > 0 ? (
          <Surface variant="section" padding="md" className="mt-8 space-y-4">
            <div className="space-y-1">
              <LabelCaps>Inbox</LabelCaps>
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
            className="mt-8"
            title="Personal account"
            description="Your individual profile used for bidding and receipts."
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-on-surface">{personal.displayName}</span>
              <StatusBadge variant="neutral" size="sm">
                {subkindLabel(personal.subkind)}
              </StatusBadge>
            </div>
          </DashboardSection>
        ) : null}

        {!loadFailure && orgs.length === 0 ? (
          <div className="mt-8">
            <DashboardEmptyState
              variant="hero"
              icon={<Building2 className="size-6" aria-hidden />}
              title={DASHBOARD_EMPTY.organisations.title}
              description={DASHBOARD_EMPTY.organisations.description}
              action={
                <Button asChild variant="cta" size="sm">
                  <Link href="/onboarding/organisation?fresh=1" prefetch>
                    Register organisation
                  </Link>
                </Button>
              }
            />
          </div>
        ) : !loadFailure ? (
          <div className="mt-10 space-y-4">
            <SectionHeader
              kicker={<LabelCaps>Workspaces</LabelCaps>}
              heading={<DisplayHeading as="h2">Your organisations</DisplayHeading>}
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/onboarding/organisation?fresh=1" prefetch>
                    Register organisation
                  </Link>
                </Button>
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {details.map(({ summary, detail }) => (
                <OrganisationCard
                  key={summary.id}
                  summary={{
                    id: summary.id,
                    displayName: summary.displayName,
                    subkind: summary.subkind,
                    status: summary.status,
                    role: summary.role,
                    isPrimaryAdmin: summary.isPrimaryAdmin,
                  }}
                  detail={detail as LegalEntity | null}
                  isActing={acting?.id === summary.id}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </DashboardPage>
  );
}
