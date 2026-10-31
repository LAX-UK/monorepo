import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { MemberList } from "@/components/legal-entity/member-list";
import { InvitesClosed } from "@/components/legal-entity/members/invites-closed";
import { AccessRequestsPanel } from "@/components/organisation-team/access-requests-panel";
import { WorkspaceTabNoAccess } from "@/components/organisation-team/workspace-tab-no-access";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { buildDashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { memberViewOnlyReason } from "@/lib/legal-entity/member-controls.vm";
import { memberRowViews } from "@/lib/legal-entity/member-row.vm";
import { teamHref } from "@/lib/navigation/client-routes";
import { requireTeamTab } from "@/lib/navigation/team-tabs";
import { accessRequestRows } from "@/lib/organisation-team/access-requests.vm";
import { activityHrefForPerson } from "@/lib/organisation-team/activity-filters";
import {
  loadPendingAccessRequests,
  loadTeamMembers,
  loadTeamScope,
  loadTwoStepPolicy,
  memberChangeActorFor,
} from "@/lib/organisation-team/team-data.server";
import {
  canDecideAccessRequests,
  entityActorCan,
  organisationInviteRefusal,
} from "@auction/domain";
import { Notice } from "@auction/ui/lax";
import { notFound } from "next/navigation";

/**
 * Team's Members tab: requests for more access waiting on an owner or admin, then everyone in
 * the organisation with their role, two-step and what the viewer may do about each. Inviting is
 * the page header's action; invitations, bidding and Activity have their own tabs.
 */
export default async function TeamMembersPage() {
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: teamHref() });
  const scope = await loadTeamScope(user);
  if (!scope) notFound();
  const { acting, actor } = scope;
  const access = requireTeamTab(actor, "members");
  if (access.kind === "forbidden") {
    return (
      <WorkspaceTabNoAccess
        access={access}
        legalEntityId={acting.id}
        organisationName={acting.displayName}
        actor={actor}
        userId={user.id}
      />
    );
  }

  const [fetched, twoStep, requests] = await Promise.all([
    loadTeamMembers(scope),
    loadTwoStepPolicy(scope),
    canDecideAccessRequests(actor) ? loadPendingAccessRequests(acting.id) : null,
  ]);
  if (!fetched.ok) {
    return (
      <DashboardSliceErrorAlert
        failure={buildDashboardSliceFailure("orgMembers", fetched.status, fetched.errorCode)}
      />
    );
  }

  const members = fetched.data;
  const changeActor = memberChangeActorFor(scope, user.id, members);
  const viewOnlyReason = memberViewOnlyReason(changeActor);
  const invitesClosed = organisationInviteRefusal(acting.status);
  const rows = memberRowViews({
    actor: changeActor,
    members,
    twoFactorByUserId: twoStep
      ? Object.fromEntries(twoStep.members.map((m) => [m.userId, m.twoFactorEnabled]))
      : undefined,
    activityHrefFor: entityActorCan(actor, "entity.activity.read")
      ? activityHrefForPerson
      : undefined,
  });
  const askRows = requests ? accessRequestRows(requests, user.id) : [];

  return (
    <div className="flex flex-col gap-8">
      {viewOnlyReason ? <Notice tone="info" title={viewOnlyReason} /> : null}
      {invitesClosed && !viewOnlyReason ? (
        <InvitesClosed refusalCode={invitesClosed.code} organisationName={acting.displayName} />
      ) : null}
      {askRows.length > 0 ? <AccessRequestsPanel legalEntityId={acting.id} rows={askRows} /> : null}
      <MemberList legalEntityId={acting.id} organisationName={acting.displayName} rows={rows} />
    </div>
  );
}
