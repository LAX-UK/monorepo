import { AccountTile } from "@/components/layout/account-switcher/account-tile";
import type { AccountRowVm } from "@/lib/organisations/organisation-accounts.vm";
import { RecordList, RecordRow } from "@auction/ui";
import { ButtonLink, StatusBadge } from "@auction/ui/lax";
import Link from "next/link";
import { initials } from "./initials";

/**
 * Every account the person can use Bid as, one row each: what it is and their role in it, a
 * badge only when it needs attention, and one step. A row opens the account; an organisation
 * still being set up offers the step that finishes it, and the row itself still opens it.
 */
export function AccountList({ rows }: { rows: readonly AccountRowVm[] }) {
  return (
    <RecordList aria-label="Your accounts">
      {rows.map((row) => (
        <RecordRow
          key={row.id}
          aria-label={row.title}
          href={row.href}
          linkAs={Link}
          leading={<AccountTile account={{ kind: row.kind, initials: initials(row.tileName) }} />}
          title={row.title}
          meta={row.meta}
          status={
            row.attention ? (
              <StatusBadge tone={row.attention.tone} shape={row.attention.shape}>
                {row.attention.label}
              </StatusBadge>
            ) : null
          }
          action={
            <ButtonLink
              href={row.step?.href ?? row.href}
              Link={Link}
              size="sm"
              // Row steps are secondary: a list never holds the page's one primary action.
              variant="secondary"
              aria-label={`${row.step?.label ?? "Open"}, ${row.title}`}
            >
              {row.step?.label ?? "Open"}
            </ButtonLink>
          }
        />
      ))}
    </RecordList>
  );
}
