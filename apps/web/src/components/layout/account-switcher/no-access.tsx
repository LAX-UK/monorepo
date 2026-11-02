"use client";

import type { WorkspaceAccessDenied } from "@/lib/presenters/workspace-access/workspace-access";
import { AccessDeniedState } from "@auction/ui/components/access-denied-state";
import { Button } from "@auction/ui/lax";
import Link from "next/link";
import { SwitchAccountAction, useHasOtherAccounts } from "./switch-account-action";
import { useAccountHomeLink } from "./use-account-home-link";

type Props = {
  /** The page the person tried to open; switching takes them back to it. */
  next: string;
  /** The page's name and, when the member's role is what stops them, who can open it. */
  denied: WorkspaceAccessDenied;
};

/**
 * "You don't have access to …": a page the role cannot open, or a record of an account the
 * person is not using. It names the page, who can open it when the role is the reason, and offers
 * the way back to the account in use (Home inside an organisation), plus Switch account for
 * someone with more than one.
 */
export function NoAccess({ next, denied }: Props) {
  const hasOtherAccounts = useHasOtherAccounts();
  const back = useAccountHomeLink();
  const subject = denied.page ? "It" : "This page";
  const reason = denied.openedBy
    ? undefined
    : hasOtherAccounts
      ? `${subject} belongs to an account you aren't using. Switch to the account it belongs to, or ask its owner to invite you.`
      : `${subject} belongs to an organisation you aren't a member of. Ask its owner to invite you.`;
  // Switching is the way on when the page belongs to another account; otherwise it is the way back.
  const switchFirst = denied.openedBy === null && hasOtherAccounts;
  return (
    <AccessDeniedState
      page={denied.page}
      openedBy={denied.openedBy}
      {...(reason ? { reason } : {})}
      actions={
        <>
          {switchFirst ? <SwitchAccountAction destination={next} emphasis="primary" /> : null}
          <Button asChild variant={switchFirst ? "secondary" : "primary"}>
            <Link href={back.href}>{back.label}</Link>
          </Button>
          {switchFirst ? null : <SwitchAccountAction destination={next} emphasis="secondary" />}
        </>
      }
    />
  );
}
