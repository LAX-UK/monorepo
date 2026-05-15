import { initials } from "@/components/organisations/initials";
import { InvitationReviewActions } from "@/components/organisations/invitation-review-actions";
import { roleLabel } from "@/components/organisations/labels";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { createPendingInvitationsGateway } from "@/lib/legal-entity/pending-invitations.gateway.server";
import { LabelCaps } from "@auction/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { StatusBadge } from "@auction/ui/components/status-badge";
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
    <div className="mx-auto max-w-lg py-6">
      <Card>
        <CardHeader>
          <LabelCaps>Invitation</LabelCaps>
          <div className="flex items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-semibold text-on-primary-container">
              {initials(invitation.orgDisplayName)}
            </div>
            <div className="min-w-0 space-y-2">
              <CardTitle className="font-headline text-xl leading-tight tracking-tight">
                {invitation.orgDisplayName}
              </CardTitle>
              <StatusBadge variant="info" size="sm">
                {roleLabel(invitation.roleOffered)}
              </StatusBadge>
            </div>
          </div>
          <CardDescription>
            Invited by {invitation.inviterName}. Expires {formatExpiry(invitation.expiresAt)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            Accepting adds this organisation to your workspace. You can decline if you don&apos;t
            recognise the invite.
          </p>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3 border-t border-outline-variant/10 pt-4">
          <InvitationReviewActions invitation={invitation} />
        </CardFooter>
      </Card>
    </div>
  );
}
