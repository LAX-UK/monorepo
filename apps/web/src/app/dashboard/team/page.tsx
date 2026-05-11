import { InviteMemberForm } from "@/components/legal-entity/invite-member-form";
import { MemberList } from "@/components/legal-entity/member-list";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { describeMemberFetchFailure } from "@/lib/legal-entity/member-fetch-error-messages";
import {
  type ILegalEntityMemberListGateway,
  createLegalEntityMemberListGateway,
} from "@/lib/legal-entity/member-list.gateway.server";
import type { LegalEntityMemberRole } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import { Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

const ADMIN_ROLES: LegalEntityMemberRole[] = ["owner", "admin"];

export default async function DashboardTeamPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/team",
  });
  const { acting, memberships } = await resolveActingContext(user.role);
  if (!acting) {
    redirect("/dashboard");
  }

  if (acting.kind === "individual") {
    const hasOrgMembership = memberships.some((m) => m.kind === "organisation");
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Team"
          description="Manage who can act on behalf of your organisation."
          className="border-b border-outline-variant/20 pb-5"
        />
        <EmptyState
          icon={<Users className="size-6" aria-hidden />}
          title="Team is for organisations"
          description={
            hasOrgMembership
              ? "Switch to one of your organisations from the header to manage its members."
              : "You don't currently belong to any organisation. Set up an organisation to enable team management."
          }
          {...(!hasOrgMembership
            ? {
                action: (
                  <Button asChild variant="outline" size="sm" className="min-h-11">
                    <Link href="/onboarding/organisation" prefetch>
                      Set up an organisation
                    </Link>
                  </Button>
                ),
              }
            : {})}
        />
      </div>
    );
  }

  const memberListGateway: ILegalEntityMemberListGateway = createLegalEntityMemberListGateway();
  const fetched = await memberListGateway.fetchMemberListForActing(acting);
  if (!fetched.ok) {
    const description = describeMemberFetchFailure(fetched.status, fetched.errorCode);
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Team"
          description={acting.displayName}
          className="border-b border-outline-variant/20 pb-5"
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
  const viewerIsAdmin = meRow ? ADMIN_ROLES.includes(meRow.role) : false;
  const viewerIsPrimaryAdmin = meRow?.isPrimaryAdmin === true;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Team"
        description={`Manage members of ${acting.displayName}.`}
        className="border-b border-outline-variant/20 pb-5"
      />

      {!viewerIsAdmin && (
        <Alert>
          <AlertTitle>Read-only view</AlertTitle>
          <AlertDescription>
            You can see your colleagues here, but only owners and admins can invite or remove
            members. Ask a primary admin if you need access.
          </AlertDescription>
        </Alert>
      )}

      {viewerIsAdmin && <InviteMemberForm legalEntityId={acting.id} />}

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
