import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { BuyerAgentsSection } from "@/components/legal-entity/buyer-agents/buyer-agents-section";
import { InviteMemberForm } from "@/components/legal-entity/invite-member-form";
import { MemberList } from "@/components/legal-entity/member-list";
import { InvitesClosed } from "@/components/legal-entity/members/invites-closed";
import { PendingInvitations } from "@/components/legal-entity/members/pending-invitations";
import { TeamSection } from "@/components/legal-entity/members/team-section";
import { StoppedMemberBidsSection } from "@/components/legal-entity/stopped-member-bids-section";
import { OrganisationTabNoAccess } from "@/components/organisations/organisation-tab-no-access";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { buildDashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerBuyerAgentOverview } from "@/lib/data/http/buyer-agent-authorisations.server";
import { getServerStoppedMemberBids } from "@/lib/data/http/organisation-membership.server";
import { getServerOrgTwoFactorPolicy } from "@/lib/data/http/two-factor-policy.server";
import { requireActiveOrganisationActor } from "@/lib/legal-entity/active-organisation.server";
import { inviteRoleOptions, memberViewOnlyReason } from "@/lib/legal-entity/member-controls.vm";
import { createLegalEntityMemberListGateway } from "@/lib/legal-entity/member-list.gateway.server";
import { invitationRowViews, memberRowViews } from "@/lib/legal-entity/member-row.vm";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { teamHref } from "@/lib/navigation/client-routes";
import { requireTeamTab } from "@/lib/navigation/team-tabs";
import { entityActorCan, organisationInviteRefusal } from "@auction/domain";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { notFound } from "next/navigation";

/**
 * Team's Members tab, for owners and admins: invite someone (or why the organisation cannot),
 * the team with each person's role, the invitations nobody has answered yet, then buyer-agent
 * authorisations. The page header already names the organisation, so nothing here repeats it.
 */
export default async function TeamMembersPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: teamHref(),
  });
  const { organisation, actor } = await requireActiveOrganisationActor(user);
  const access = requireTeamTab(actor, "members");
  if (access.kind === "forbidden") return <OrganisationTabNoAccess access={access} />;
  const ctx = await createPerOrgGateway().getContext(organisation.id);
  if (!ctx) notFound();
  const { member } = ctx;
  const id = organisation.id;
  const organisationName = member.displayName;
  const acting = {
    id,
    displayName: organisationName,
    kind: member.kind,
    subkind: member.subkind,
    status: member.status,
    role: member.role,
    isPrimaryAdmin: member.isPrimaryAdmin,
  };

  const gateway = createLegalEntityMemberListGateway();
  const [fetched, invitations] = await Promise.all([
    gateway.fetchMemberListForActing(acting),
    gateway.fetchPendingInvitations(id),
  ]);
  if (!fetched.ok) {
    return (
      <DashboardSliceErrorAlert
        failure={buildDashboardSliceFailure("orgMembers", fetched.status, fetched.errorCode)}
      />
    );
  }

  const members = fetched.data;
  // Support staff viewing as the client are not in the list (`memberId` null).
  const changeActor = { ...actor, memberId: members.find((m) => m.userId === user.id)?.id ?? null };
  const inviteRoles = inviteRoleOptions(changeActor);
  // The organisation's state can close inviting whatever the role: say why in place of the form.
  const invitesClosed = organisationInviteRefusal(acting.status);
  const viewOnlyReason = memberViewOnlyReason(changeActor);
  const isOrganisation = acting.kind === "organisation";

  const [twoFactorPolicy, buyerAgentOverview, stoppedMemberBids] = await Promise.all([
    // Owners and admins see who has two-step sign-in on; the policy is its own tab.
    isOrganisation && entityActorCan(actor, "entity.security.read")
      ? getServerOrgTwoFactorPolicy(id)
      : null,
    isOrganisation && entityActorCan(actor, "entity.buyer_agents.read")
      ? getServerBuyerAgentOverview(id).catch(() => null)
      : null,
    // What stopped when members left, for the people who see the team (read-only).
    isOrganisation ? getServerStoppedMemberBids(id).catch(() => null) : null,
  ]);
  const twoFactorByUserId = twoFactorPolicy
    ? Object.fromEntries(twoFactorPolicy.members.map((m) => [m.userId, m.twoFactorEnabled]))
    : undefined;

  const rows = memberRowViews({ actor: changeActor, members, twoFactorByUserId });
  const invitationRows = invitations.ok
    ? invitationRowViews(changeActor, invitations.data, new Date())
    : [];

  return (
    <div className="space-y-6">
      {viewOnlyReason ? (
        <Alert>
          <AlertTitle>View only</AlertTitle>
          <AlertDescription>{viewOnlyReason}</AlertDescription>
        </Alert>
      ) : null}

      {inviteRoles.length > 0 ? (
        <TeamSection
          id="invite"
          title="Invite someone"
          {...(invitesClosed
            ? {}
            : { description: `We'll email them a link to join ${organisationName}.` })}
        >
          {invitesClosed ? (
            <InvitesClosed refusalCode={invitesClosed.code} organisationName={organisationName} />
          ) : (
            <InviteMemberForm
              legalEntityId={id}
              organisationName={organisationName}
              roleOptions={inviteRoles}
            />
          )}
        </TeamSection>
      ) : null}

      <TeamSection id="team" title="Team" count={rows.length} countLabel="people">
        <MemberList legalEntityId={id} organisationName={organisationName} rows={rows} />
      </TeamSection>

      {invitationRows.length > 0 ? (
        <TeamSection
          id="invitations"
          title="Invitations"
          count={invitationRows.filter((row) => !row.expired).length}
          countLabel="waiting for an answer"
        >
          <PendingInvitations legalEntityId={id} rows={invitationRows} />
        </TeamSection>
      ) : null}
      {!invitations.ok ? (
        <Alert>
          <AlertDescription>
            We couldn't load the invitations waiting for an answer. Refresh the page to try again.
          </AlertDescription>
        </Alert>
      ) : null}

      {buyerAgentOverview ? (
        <BuyerAgentsSection
          legalEntityId={id}
          entityName={organisationName}
          overview={buyerAgentOverview}
        />
      ) : null}

      <StoppedMemberBidsSection entityName={organisationName} stopped={stoppedMemberBids ?? []} />
    </div>
  );
}
