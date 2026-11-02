import { PendingInvitations } from "@/components/legal-entity/members/pending-invitations";
import { WorkspaceTabNoAccess } from "@/components/organisation-team/workspace-tab-no-access";
import { ListEmpty, ListLoadError } from "@/components/workspace/list-states";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { invitationRowViews } from "@/lib/legal-entity/member-row.vm";
import { teamHref } from "@/lib/navigation/client-routes";
import { requireTeamTab } from "@/lib/navigation/team-tabs";
import {
  loadTeamInvitations,
  loadTeamMembers,
  loadTeamScope,
  memberChangeActorFor,
} from "@/lib/organisation-team/team-data.server";
import { notFound } from "next/navigation";

/**
 * Team's Invitations tab: invitations nobody has answered, waiting ones first, with Resend and
 * Withdraw; expired ones stay until resent or removed.
 */
export default async function TeamInvitationsPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: teamHref("invitations"),
  });
  const scope = await loadTeamScope(user);
  if (!scope) notFound();
  const { acting, actor } = scope;
  const access = requireTeamTab(actor, "invitations");
  if (access.kind === "forbidden") {
    return (
      <WorkspaceTabNoAccess
        access={access}
        legalEntityId={acting.id}
        actor={actor}
        userId={user.id}
      />
    );
  }

  const [invitations, members] = await Promise.all([
    loadTeamInvitations(acting.id),
    loadTeamMembers(scope),
  ]);
  if (!invitations.ok) {
    return <ListLoadError />;
  }
  const changeActor = memberChangeActorFor(scope, user.id, members.ok ? members.data : []);
  const rows = invitationRowViews(changeActor, invitations.data, new Date()).sort(
    (a, b) => Number(a.expired) - Number(b.expired),
  );

  if (rows.length === 0) {
    return (
      <ListEmpty
        illustration="easel"
        title="No invitations waiting"
        description={`Everyone you've invited has answered. Invite colleagues so they can bid, pay or sell for ${acting.displayName}.`}
      />
    );
  }
  return <PendingInvitations legalEntityId={acting.id} rows={rows} />;
}
