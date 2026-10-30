import { invitesClosedCopy } from "@/lib/legal-entity/member-change-copy";
import { Notice } from "@auction/ui/lax";

type Props = { refusalCode: string; organisationName: string };

/** Where "Invite members" would be, while the organisation's state closes inviting. */
export function InvitesClosed({ refusalCode, organisationName }: Props) {
  const copy = invitesClosedCopy(refusalCode, organisationName);
  return (
    <div data-testid="invites-closed">
      <Notice tone="info" title={copy.line} />
    </div>
  );
}
