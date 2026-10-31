import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { LeaveOrCloseCard } from "@/components/organisation-team/leave-or-close-card";
import { WorkspacePageTabs } from "@/components/organisation-team/workspace-page-tabs";
import { subkindLabel } from "@/components/organisations/labels";
import { OrganisationSettingsUnavailable } from "@/components/organisations/organisation-settings-unavailable";
import { OrganisationStateBannerForRoute } from "@/components/organisations/organisation-state-banner-for-route";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { resolveActiveOrganisationActor } from "@/lib/legal-entity/active-organisation.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { organisationTabsFor } from "@/lib/navigation/organisation-tabs";
import { loadOrganisationStateBanner } from "@/lib/organisations/organisation-state-banner.server";
import { organisationStatusView } from "@/lib/presenters/organisation-status/organisation-status-presentation";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

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
        <div className="space-y-6">
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
    // Nothing here to manage, but any member can leave (support staff viewing as the client are
    // not members).
    return (
      <DashboardPage>
        <div className="flex flex-col gap-8">
          <OrganisationSettingsUnavailable reason="role" organisationName={member.displayName} />
          {active.actor.isImpersonation ? null : (
            <div className="mx-auto w-full max-w-[640px]">
              <LeaveOrCloseCard
                legalEntityId={member.id}
                organisationName={member.displayName}
                leave={{ allowed: true }}
                canClose={false}
              />
            </div>
          )}
        </div>
      </DashboardPage>
    );
  }

  // The same state banner as Home, for the same audience: only people who can act are asked.
  const banner = entity ? await loadOrganisationStateBanner(active.actor, entity) : null;
  const status = organisationStatusView(member.status);

  return (
    <DashboardPage>
      <div className="space-y-6">
        <DashboardPageHeader
          title={member.displayName}
          description="Your organisation's details, team and settings."
          actions={
            // The state is a status; the organisation's type is a plain fact beside it.
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              <span className="font-body text-sm leading-5 text-on-surface-variant">
                {subkindLabel(member.subkind)}
              </span>
            </div>
          }
        />
        <WorkspacePageTabs
          label="Organisation"
          items={tabs.map((tab) => ({ id: tab.id, label: tab.label, href: tab.href }))}
        />
        {banner ? <OrganisationStateBannerForRoute banner={banner} /> : null}
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </DashboardPage>
  );
}
