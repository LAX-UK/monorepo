import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { InvitationCardList } from "@/components/organisations/invitation-card-list";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { createPendingInvitationsGateway } from "@/lib/legal-entity/pending-invitations.gateway.server";
import { Button } from "@auction/ui/components/button";
import { Inbox } from "lucide-react";
import Link from "next/link";

export default async function InvitationsInboxPage() {
  await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/invitations",
  });
  const gw = createPendingInvitationsGateway();
  const pending = await gw.listMine();

  return (
    <DashboardPage>
      <div className="mx-auto max-w-5xl space-y-8">
        <DashboardPageHeader
          meta="Invitation"
          title="Invitations"
          description="Pending organisation invitations for your account email."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/organisations" prefetch>
                Back to organisations
              </Link>
            </Button>
          }
        />

        {pending.length === 0 ? (
          <DashboardEmptyState
            icon={<Inbox className="size-6" aria-hidden />}
            title="No pending invitations"
            description="When someone invites you to an organisation, it will show up here."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/organisations" prefetch>
                  Go to Organisations
                </Link>
              </Button>
            }
          />
        ) : (
          <InvitationCardList invitations={pending} />
        )}
      </div>
    </DashboardPage>
  );
}
