import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardDetailHeader } from "@/components/dashboard/primitives/dashboard-detail-header";
import { initials } from "@/components/organisations/initials";
import { InvitationReviewActions } from "@/components/organisations/invitation-review-actions";
import { roleLabel } from "@/components/organisations/labels";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { createPendingInvitationsGateway } from "@/lib/legal-entity/pending-invitations.gateway.server";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";
import { notFound } from "next/navigation";

function formatExpiry(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function InvitationReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAuthenticatedUser({
    shell: "client",
    loginNext: `/dashboard/invitations/review/${id}`,
  });
  const gw = createPendingInvitationsGateway();
  const pending = await gw.listMine();
  const invitation = pending.find((p) => p.id === id);
  if (!invitation) {
    notFound();
  }

  return (
    <DashboardPage className="mx-auto max-w-lg space-y-6">
      <DashboardDetailHeader
        backHref="/dashboard/invitations"
        backLabel="Invitations"
        eyebrow="Invitation"
        title={invitation.orgDisplayName}
        badges={
          <StatusBadge variant="info" size="sm">
            {roleLabel(invitation.roleOffered)}
          </StatusBadge>
        }
      />
      <Surface variant="section" padding="lg" className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-semibold text-on-primary-container">
            {initials(invitation.orgDisplayName)}
          </div>
          <p className="font-body text-sm text-on-surface-variant">
            Invited by {invitation.inviterName}. Expires {formatExpiry(invitation.expiresAt)}.
          </p>
        </div>
        <p className="font-body text-sm text-on-surface-variant">
          Accepting adds this organisation to your workspace. You can decline if you don&apos;t
          recognise the invite.
        </p>
        <div className="flex flex-wrap gap-3 border-t border-border-hairline pt-4">
          <InvitationReviewActions invitation={invitation} />
        </div>
      </Surface>
    </DashboardPage>
  );
}
