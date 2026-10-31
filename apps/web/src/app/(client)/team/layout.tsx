import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { InviteMembersButton } from "@/components/organisation-team/invite-members-dialog";
import { WorkspacePageTabs } from "@/components/organisation-team/workspace-page-tabs";
import { OrganisationSettingsUnavailable } from "@/components/organisations/organisation-settings-unavailable";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { inviteRoleOptions } from "@/lib/legal-entity/member-controls.vm";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { CLIENT_ROUTES, teamHref } from "@/lib/navigation/client-routes";
import { teamTabsFor } from "@/lib/navigation/team-tabs";
import { loadTeamTabCounts } from "@/lib/organisation-team/team-counts.server";
import {
  loadTeamMembers,
  loadTeamScope,
  memberChangeActorFor,
} from "@/lib/organisation-team/team-data.server";
import { organisationInviteRefusal } from "@auction/domain";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The Team page: who can act for the organisation and what each person may do, for owners and
 * admins. Its tabs are Members, Invitations, Who can bid and Activity, each with its count;
 * "Invite members" is the page's one primary action. Each tab page checks its own access, so a
 * member whose role does not open it is told why in place.
 */
export default async function TeamLayout({ children }: { children: ReactNode }) {
  if (!(await resolveOrgModuleEnabledFromRequest())) redirect(CLIENT_ROUTES.organisations);
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: teamHref() });
  const scope = await loadTeamScope(user);
  if (!scope) {
    return (
      <DashboardPage>
        <OrganisationSettingsUnavailable reason="personal" />
      </DashboardPage>
    );
  }
  const { acting, actor } = scope;
  const tabs = teamTabsFor(actor);
  const [members, counts] = await Promise.all([
    tabs.length > 0 ? loadTeamMembers(scope) : null,
    loadTeamTabCounts(scope, tabs),
  ]);
  const inviteRoles =
    members?.ok && !organisationInviteRefusal(acting.status)
      ? inviteRoleOptions(memberChangeActorFor(scope, user.id, members.data))
      : [];

  return (
    <DashboardPage>
      <div className="space-y-6">
        <DashboardPageHeader
          title="Team"
          description={`Who can act for ${acting.displayName}, and what each person can do.`}
          actions={
            inviteRoles.length > 0 ? (
              <InviteMembersButton
                legalEntityId={acting.id}
                organisationName={acting.displayName}
                roleOptions={inviteRoles}
              />
            ) : undefined
          }
        />
        {tabs.length > 1 ? (
          <WorkspacePageTabs
            label="Team"
            items={tabs.map((tab) => ({
              id: tab.id,
              label: tab.label,
              href: tab.href,
              ...(counts[tab.id] === undefined ? {} : { count: counts[tab.id] }),
            }))}
          />
        ) : null}
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </DashboardPage>
  );
}
