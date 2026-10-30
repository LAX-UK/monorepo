import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { SectionTabsNav } from "@/components/dashboard/section-tabs-nav";
import { OrganisationSettingsUnavailable } from "@/components/organisations/organisation-settings-unavailable";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { resolveActiveOrganisationActor } from "@/lib/legal-entity/active-organisation.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { CLIENT_ROUTES, teamHref } from "@/lib/navigation/client-routes";
import { teamTabsFor } from "@/lib/navigation/team-tabs";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The Team page: who is in the organisation and what each person may do. A top-level page for
 * owners and admins, with Members as its first tab. Each tab page checks its own access, so a
 * member whose role does not open it is told why in place.
 */
export default async function TeamLayout({ children }: { children: ReactNode }) {
  if (!(await resolveOrgModuleEnabledFromRequest())) redirect(CLIENT_ROUTES.organisations);
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: teamHref() });
  const active = await resolveActiveOrganisationActor(user);
  if (!active) {
    return (
      <DashboardPage>
        <OrganisationSettingsUnavailable reason="personal" />
      </DashboardPage>
    );
  }
  const tabs = teamTabsFor(active.actor);
  return (
    <DashboardPage>
      <div className="space-y-6">
        <DashboardPageHeader
          title="Team"
          description="Who is in your organisation, and what each person can do."
        />
        {/* One tab is the page itself; the row appears once Team has a second tab. */}
        {tabs.length > 1 ? (
          <SectionTabsNav
            ariaLabel="Team"
            sticky={false}
            exactHrefs={[CLIENT_ROUTES.team]}
            items={tabs.map((tab) => ({ href: tab.href, label: tab.label }))}
          />
        ) : null}
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </DashboardPage>
  );
}
