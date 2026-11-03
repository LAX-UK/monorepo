import { AccountTile } from "@/components/layout/account-switcher/account-tile";
import type { InvitationRowVm } from "@/lib/organisations/organisation-accounts.vm";
import { RecordList, RecordRow } from "@auction/ui";
import { ButtonLink } from "@auction/ui/lax";
import Link from "next/link";
import { initials } from "./initials";

/** Invitations to join an organisation that wait for an answer; Review opens the invitation. */
export function InvitationList({ rows }: { rows: readonly InvitationRowVm[] }) {
  return (
    <RecordList aria-label="Pending invitations">
      {rows.map((row) => (
        <RecordRow
          key={row.id}
          aria-label={`Invitation to ${row.title}`}
          href={row.reviewHref}
          linkAs={Link}
          leading={
            <AccountTile account={{ kind: "organisation", initials: initials(row.title) }} />
          }
          title={row.title}
          meta={row.meta}
          action={
            <ButtonLink
              href={row.reviewHref}
              Link={Link}
              size="sm"
              variant="secondary"
              aria-label={`Review invitation to ${row.title}`}
            >
              Review
            </ButtonLink>
          }
        />
      ))}
    </RecordList>
  );
}
