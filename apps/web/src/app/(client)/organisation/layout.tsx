import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { EntityStatusBanner } from "@/components/dashboard/entity-status-banner";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { SectionTabsNav } from "@/components/dashboard/section-tabs-nav";
import { statusBadgeVariant, statusLabel, subkindLabel } from "@/components/organisations/labels";
import { OrganisationSettingsUnavailable } from "@/components/organisations/organisation-settings-unavailable";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { resolveActiveOrganisationActor } from "@/lib/legal-entity/active-organisation.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { organisationTabsFor } from "@/lib/navigation/organisation-tabs";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

/** Pills read as words here, so they opt out of the badge's capitals. */
const TAG_CASE = "normal-case tracking-normal";

/**
 * One Organisation page with tabs (Profile, Members, Documents, Payouts, Security) for the
 * active organisation account. Each member sees only the tabs their role can use.
 */
export default async function OrganisationLayout({ children }: { children: ReactNode }) {
  if (!(await resolveOrgModuleEnabledFromRequest())) {
    redirect(CLIENT_ROUTES.organisations);
  }
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: CLIENT_ROUTES.organisation,
  });
  const active = await resolveActiveOrganisationActor(user);
  if (!active) {
    return (
      <DashboardPage>
        <OrganisationSettingsUnavailable reason="personal" />
      </DashboardPage>
    );
  }

  const access = await createPerOrgGateway().resolveAccess(active.organisation.id);
  if (access.kind === "not_found") notFound();
  if (access.kind === "forbidden") {
    return (
      <DashboardPage>
        <div className="mx-auto max-w-5xl space-y-6">
          <DashboardPageHeader title="Organisation" />
          <DashboardSliceErrorAlert failure={access.failure} />
        </div>
      </DashboardPage>
    );
  }

  const { member, entity } = access.context;
  // Support staff viewing as the client open the reading tabs only (`entityActorCan`).
  const tabs = organisationTabsFor(active.actor);
  if (tabs.length === 0) {
    return (
      <DashboardPage>
        <OrganisationSettingsUnavailable reason="role" organisationName={member.displayName} />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <div className="mx-auto max-w-5xl space-y-6">
        <DashboardPageHeader
          title={member.displayName}
          description="Your organisation's details, team and settings."
          hideDescriptionOnMobile
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                variant={statusBadgeVariant(member.status)}
                size="sm"
                className={TAG_CASE}
              >
                {statusLabel(member.status)}
              </StatusBadge>
              <StatusBadge variant="neutral" size="sm" className={TAG_CASE}>
                {subkindLabel(member.subkind)}
              </StatusBadge>
            </div>
          }
        />
        <SectionTabsNav
          ariaLabel="Organisation"
          sticky={false}
          // The Profile tab is the page itself, so it is current only on its own address.
          exactHrefs={[CLIENT_ROUTES.organisation]}
          items={tabs.map((tab) => ({ href: tab.href, label: tab.label }))}
        />
        {entity ? <EntityStatusBanner acting={{ ...member, status: entity.status }} /> : null}
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </DashboardPage>
  );
}
