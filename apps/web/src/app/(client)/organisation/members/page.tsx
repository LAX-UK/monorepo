import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardErrorAlert } from "@/components/dashboard/primitives";
import { BuyerAgentsSection } from "@/components/legal-entity/buyer-agents/buyer-agents-section";
import { FormerMemberBidsSection } from "@/components/legal-entity/former-member-bids-section";
import { InviteMemberForm } from "@/components/legal-entity/invite-member-form";
import { MemberList } from "@/components/legal-entity/member-list";
import { OrgTabSectionHeader } from "@/components/organisations/org-tab-section-header";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { buildDashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerBuyerAgentOverview } from "@/lib/data/http/buyer-agent-authorisations.server";
import { getServerFormerMemberBids } from "@/lib/data/http/organisation-membership.server";
import { getServerOrgTwoFactorPolicy } from "@/lib/data/http/two-factor-policy.server";
import { requireActiveOrganisationId } from "@/lib/legal-entity/active-organisation.server";
import {
  type ILegalEntityMemberListGateway,
  createLegalEntityMemberListGateway,
} from "@/lib/legal-entity/member-list.gateway.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { organisationHref } from "@/lib/navigation/client-routes";
import { entityRoleCan } from "@auction/domain";
import { DisplayHeading } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { SectionHeader } from "@auction/ui/components/section-header";
import { Surface } from "@auction/ui/components/surface";
import { notFound } from "next/navigation";

export default async function OrganisationMembersPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: organisationHref("members"),
  });
  const id = await requireActiveOrganisationId(user);
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
  const meRow = members.find((m) => m.userId === user.id);
  const missingSelfInList = !meRow;
  const viewerIsAdmin = meRow ? entityRoleCan(meRow.role, "entity.members.manage") : false;
  const viewerIsPrimaryAdmin = meRow?.isPrimaryAdmin === true;
  // Admins see which members have two-step verification on; the policy itself is on its own page.
  const twoFactorPolicy =
    viewerIsAdmin && acting.kind === "organisation"
      ? await getServerOrgTwoFactorPolicy(acting.id)
      : null;
  const canSeeBuyerAgents =
    acting.kind === "organisation" &&
    meRow != null &&
    entityRoleCan(meRow.role, "entity.buyer_agents.read");
  const buyerAgentOverview = canSeeBuyerAgents
    ? await getServerBuyerAgentOverview(acting.id).catch(() => null)
    : null;
  // Bids people who left placed for the organisation; only the people who run it decide on them.
  const formerMemberBids =
    acting.kind === "organisation" &&
    meRow != null &&
    entityRoleCan(meRow.role, "entity.member_bids.cancel")
      ? ((await getServerFormerMemberBids(acting.id).catch(() => null)) ?? [])
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

      {missingSelfInList ? (
        <DashboardErrorAlert
          title="Could not verify your membership"
          message="Your account is not listed in the member response we received. Refresh the page or ask an organisation admin to confirm your access."
        />
      ) : null}

      {!missingSelfInList && !viewerIsAdmin && (
        <Alert>
          <AlertTitle>Read-only view</AlertTitle>
          <AlertDescription>
            You can see your colleagues here, but only owners and admins can invite or remove
            members.
          </AlertDescription>
        </Alert>
      )}

      {!missingSelfInList && viewerIsAdmin ? (
        <Surface variant="section" padding="md" className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-on-surface">Invite someone</h3>
            <p className="font-body text-sm text-on-surface-variant">
              They&apos;ll receive an email invitation to join this organisation.
            </p>
          </div>
          <InviteMemberForm legalEntityId={acting.id} />
        </Surface>
      ) : null}

      <MemberList
        legalEntityId={acting.id}
        {...(twoFactorByUserId ? { twoFactorByUserId } : {})}
        members={members}
        viewerIsAdmin={viewerIsAdmin}
        viewerIsPrimaryAdmin={viewerIsPrimaryAdmin}
        viewerUserId={user.id}
      />

      {buyerAgentOverview ? (
        <BuyerAgentsSection
          legalEntityId={acting.id}
          entityName={acting.displayName}
          overview={buyerAgentOverview}
        />
      ) : null}

      <FormerMemberBidsSection
        legalEntityId={acting.id}
        entityName={acting.displayName}
        bids={formerMemberBids}
      />
    </div>
  );
}
