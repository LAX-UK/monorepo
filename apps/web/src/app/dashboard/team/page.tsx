import { InviteMemberForm } from "@/components/legal-entity/invite-member-form";
import { MemberList } from "@/components/legal-entity/member-list";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import {
  type ActingLegalEntitySummary,
  X_LEGAL_ENTITY_ID_HEADER,
} from "@/lib/legal-entity/client-acting-context";
import type { LegalEntityMemberRole } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import { Users } from "lucide-react";
import { redirect } from "next/navigation";

const ADMIN_ROLES: LegalEntityMemberRole[] = ["owner", "admin"];

type MemberRow = {
  id: string;
  legalEntityId: string;
  userId: string;
  role: LegalEntityMemberRole;
  isPrimaryAdmin: boolean;
  invitedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string; image: string | null };
};

async function fetchMembers(
  acting: ActingLegalEntitySummary,
): Promise<{ ok: true; data: MemberRow[] } | { ok: false; status: number }> {
  const res = await authedServerFetch("/legal-entities/members", {
    headers: { [X_LEGAL_ENTITY_ID_HEADER]: acting.id },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status };
  const body = (await res.json()) as { data: MemberRow[] };
  return { ok: true, data: body.data };
}

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
            memberships.some((m) => m.kind === "organisation")
              ? "Switch to one of your organisations from the header to manage its members."
              : "You don't currently belong to any organisation. Submit a consignment to LAX as an organisation to enable team management."
          }
        />
      </div>
    );
  }

  const fetched = await fetchMembers(acting);
  if (!fetched.ok) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Team"
          description={acting.displayName}
          className="border-b border-outline-variant/20 pb-5"
        />
        <Alert variant="destructive">
          <AlertTitle>Could not load members</AlertTitle>
          <AlertDescription>
            We couldn't fetch the member list (status {fetched.status}). Refresh to try again.
          </AlertDescription>
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
