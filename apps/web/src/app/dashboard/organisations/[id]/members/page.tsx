import { DashboardErrorAlert } from "@/components/dashboard/primitives";
import { InviteMemberForm } from "@/components/legal-entity/invite-member-form";
import { MemberList } from "@/components/legal-entity/member-list";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { describeMemberFetchFailure } from "@/lib/legal-entity/member-fetch-error-messages";
import {
  type ILegalEntityMemberListGateway,
  createLegalEntityMemberListGateway,
} from "@/lib/legal-entity/member-list.gateway.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import type { LegalEntityMemberRole } from "@auction/types";
import { DisplayHeading, LabelCaps } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { SectionHeader } from "@auction/ui/components/section-header";
import { notFound } from "next/navigation";

const ADMIN_ROLES: LegalEntityMemberRole[] = ["owner", "admin"];

export default async function OrganisationMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: `/dashboard/organisations/${id}/members`,
  });
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
    const description = describeMemberFetchFailure(fetched.status, fetched.errorCode);
    return (
      <div className="space-y-6">
        <SectionHeader
          kicker={<LabelCaps>Team</LabelCaps>}
          heading={<DisplayHeading as="h2">Members</DisplayHeading>}
        />
        <Alert variant="destructive">
          <AlertTitle>Could not load members</AlertTitle>
          <AlertDescription>{description}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const members = fetched.data;
  const meRow = members.find((m) => m.userId === user.id);
  const missingSelfInList = !meRow;
  const viewerIsAdmin = meRow ? ADMIN_ROLES.includes(meRow.role) : false;
  const viewerIsPrimaryAdmin = meRow?.isPrimaryAdmin === true;

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker={<LabelCaps>Team</LabelCaps>}
        heading={<DisplayHeading as="h2">Members</DisplayHeading>}
        action={
          <p className="max-w-md text-right text-sm text-on-surface-variant">
            {acting.displayName}
          </p>
        }
      />

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
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Invite someone</CardTitle>
            <CardDescription>
              They&apos;ll receive an email invitation to join this organisation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteMemberForm legalEntityId={acting.id} />
          </CardContent>
        </Card>
      ) : null}

      <MemberList
        legalEntityId={acting.id}
        members={members}
        viewerIsAdmin={viewerIsAdmin}
        viewerIsPrimaryAdmin={viewerIsPrimaryAdmin}
        viewerUserId={user.id}
      />
    </div>
  );
}
