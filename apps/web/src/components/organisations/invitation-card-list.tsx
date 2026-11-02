import type { PendingInvitationRow } from "@/lib/legal-entity/pending-invitations.gateway.server";
import { organisationRoleLabel } from "@/lib/presenters/organisation-role/organisation-role-presentation";
import { Card, CardFooter, CardHeader, CardTitle } from "@auction/ui/components/card";
import { Button } from "@auction/ui/lax";
import Link from "next/link";

type ListProps = {
  invitations: PendingInvitationRow[];
};

function formatExpiry(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function InvitationCardList({ invitations }: ListProps) {
  if (invitations.length === 0) return null;
  return (
    <ul className="space-y-3">
      {invitations.map((inv) => (
        <li key={inv.id}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">{inv.orgDisplayName}</CardTitle>
              <p className="text-sm text-on-surface-variant">
                From {inv.inviterName} · {organisationRoleLabel(inv.roleOffered)}
              </p>
              <p className="text-xs text-on-surface-variant">
                Expires {formatExpiry(inv.expiresAt)}
              </p>
            </CardHeader>
            <CardFooter className="justify-end border-t-0 pt-0">
              <Button asChild size="md" variant="primary">
                <Link href={`/organisations/invitations/review/${encodeURIComponent(inv.id)}`}>
                  Review
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </li>
      ))}
    </ul>
  );
}
