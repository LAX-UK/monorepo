import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { BuyerAgentsSection } from "@/components/legal-entity/buyer-agents/buyer-agents-section";
import { InviteMemberForm } from "@/components/legal-entity/invite-member-form";
import { MemberList } from "@/components/legal-entity/member-list";
import { StoppedMemberBidsSection } from "@/components/legal-entity/stopped-member-bids-section";
import { OrgTabSectionHeader } from "@/components/organisations/org-tab-section-header";
import { OrganisationTabNoAccess } from "@/components/organisations/organisation-tab-no-access";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { buildDashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerBuyerAgentOverview } from "@/lib/data/http/buyer-agent-authorisations.server";
import { getServerStoppedMemberBids } from "@/lib/data/http/organisation-membership.server";
import { getServerOrgTwoFactorPolicy } from "@/lib/data/http/two-factor-policy.server";
import { requireActiveOrganisationActor } from "@/lib/legal-entity/active-organisation.server";
import {
  inviteRoleOptions,
  memberRowControls,
  memberViewOnlyReason,
} from "@/lib/legal-entity/member-controls.vm";
import {
  type ILegalEntityMemberListGateway,
  createLegalEntityMemberListGateway,
} from "@/lib/legal-entity/member-list.gateway.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { organisationHref } from "@/lib/navigation/client-routes";
import { requireOrganisationTab } from "@/lib/navigation/organisation-tabs";
import { entityActorCan, organisationJoinRefusal } from "@auction/domain";
import { DisplayHeading } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { SectionHeader } from "@auction/ui/components/section-header";
import { Surface } from "@auction/ui/components/surface";
import { Info } from "lucide-react";
import { notFound } from "next/navigation";

export default async function OrganisationMembersPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: organisationHref("members"),
  });
  const { organisation, actor } = await requireActiveOrganisationActor(user);
  const access = requireOrganisationTab(actor, "members");
  if (access.kind === "forbidden") return <OrganisationTabNoAccess access={access} />;
  const id = organisation.id;
  const perOrgGw = createPerOrgGateway();
  const ctx = await perOrgGw.getContext(id);
  if (!ctx) notFound();
  const { member } = ctx;

  const acting = {
    id,
    displayName: member.displayName,
    kind: member.kind,
    subkind: member.subkind,
    status: member.status,
    role: member.role,
    isPrimaryAdmin: member.isPrimaryAdmin,
  };

  const memberListGateway: ILegalEntityMemberListGateway = createLegalEntityMemberListGateway();
  const fetched = await memberListGateway.fetchMemberListForActing(acting);
  if (!fetched.ok) {
    const failure = buildDashboardSliceFailure("orgMembers", fetched.status, fetched.errorCode);
    return (
      <div className="space-y-6">
        <OrgTabSectionHeader>
          <SectionHeader heading={<DisplayHeading as="h2">Members</DisplayHeading>} />
        </OrgTabSectionHeader>
        <DashboardSliceErrorAlert failure={failure} />
      </div>
    );
  }

  const members = fetched.data;
  const me = members.find((m) => m.userId === user.id);
  // Support staff viewing as the client are not in the list (`memberId` null).
  const changeActor = { ...actor, memberId: me?.id ?? null };
  const rows = members.map((row) => ({
    member: row,
    controls: memberRowControls(changeActor, row, members),
  }));
  const inviteRoles = inviteRoleOptions(changeActor);
  // The organisation's state can close it to new members whatever the role; say so, in the
  // server's words, instead of offering a form the server would refuse.
  const invitesClosed = organisationJoinRefusal(acting.status);
  const viewOnlyReason = memberViewOnlyReason(changeActor);
  const isOrganisation = acting.kind === "organisation";
  // Owners and admins see which members have two-step verification on; the policy is its own tab.
  const twoFactorPolicy =
    isOrganisation && entityActorCan(actor, "entity.security.read")
      ? await getServerOrgTwoFactorPolicy(acting.id)
      : null;
  const buyerAgentOverview =
    isOrganisation && entityActorCan(actor, "entity.buyer_agents.read")
      ? await getServerBuyerAgentOverview(acting.id).catch(() => null)
      : null;
  // What stopped when members left, for the people who see the team (read-only).
  const stoppedMemberBids = isOrganisation
    ? ((await getServerStoppedMemberBids(acting.id).catch(() => null)) ?? [])
    : [];
  const twoFactorByUserId = twoFactorPolicy
    ? Object.fromEntries(twoFactorPolicy.members.map((m) => [m.userId, m.twoFactorEnabled]))
    : undefined;

  return (
    <div className="space-y-6">
      <OrgTabSectionHeader>
        <SectionHeader
          heading={<DisplayHeading as="h2">Members</DisplayHeading>}
          action={
            <p className="max-w-md text-right text-sm text-on-surface-variant">
              {acting.displayName}
            </p>
          }
        />
      </OrgTabSectionHeader>

      {viewOnlyReason ? (
        <Alert>
          <AlertTitle>View only</AlertTitle>
          <AlertDescription>{viewOnlyReason}</AlertDescription>
        </Alert>
      ) : null}

      {inviteRoles.length > 0 && invitesClosed ? (
        <p
          className="flex items-start gap-2 font-body text-sm text-on-surface-variant"
          data-testid="invites-closed"
        >
          <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          {invitesClosed.message}
        </p>
      ) : inviteRoles.length > 0 ? (
        <Surface variant="section" padding="md" className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-on-surface">Invite someone</h3>
            <p className="font-body text-sm text-on-surface-variant">
              They&apos;ll receive an email invitation to join this organisation.
            </p>
          </div>
          <InviteMemberForm legalEntityId={acting.id} roleOptions={inviteRoles} />
        </Surface>
      ) : null}

      <MemberList
        legalEntityId={acting.id}
        {...(twoFactorByUserId ? { twoFactorByUserId } : {})}
        rows={rows}
      />

      {buyerAgentOverview ? (
        <BuyerAgentsSection
          legalEntityId={acting.id}
          entityName={acting.displayName}
          overview={buyerAgentOverview}
        />
      ) : null}

      <StoppedMemberBidsSection entityName={acting.displayName} stopped={stoppedMemberBids} />
    </div>
  );
}
