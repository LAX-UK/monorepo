import { roleLabel } from "@/components/organisations/labels";
import type { PendingInvitationRow } from "@/lib/legal-entity/pending-invitations.gateway.server";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@auction/ui/components/card";
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
                From {inv.inviterName} · {roleLabel(inv.roleOffered)}
              </p>
              <p className="text-xs text-on-surface-variant">
                Expires {formatExpiry(inv.expiresAt)}
              </p>
            </CardHeader>
            <CardFooter className="justify-end border-t-0 pt-0">
              <Button asChild size="sm" variant="cta">
                <Link href={`/dashboard/invitations/review/${encodeURIComponent(inv.id)}`}>
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

type BadgeProps = { count: number };

export function PendingInvitationsBadge({ count }: BadgeProps) {
  if (count <= 0) return null;
  return (
    <Badge variant="destructive" className="ml-1 min-w-6 justify-center px-1.5 text-[10px]">
      {count > 9 ? "9+" : count}
    </Badge>
  );
}
