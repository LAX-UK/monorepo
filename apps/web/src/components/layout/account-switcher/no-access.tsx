"use client";

import type { WorkspaceAccessDenied } from "@/lib/presenters/workspace-access/workspace-access";
import { AccessDeniedState } from "@auction/ui/components/access-denied-state";
import { Button } from "@auction/ui/lax/button";
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
 * "You don't have access to …": a page the role cannot open, or a page of one of the person's
 * accounts other than the one in use. (Someone else's record never lands here: it is not found.)
 * It names the page, who can open it when the role is the reason, and offers the way back: to the
 * record's own list for a record, else to the account in use (Home inside an organisation), plus
 * Switch account for someone with more than one.
 */
export function NoAccess({ next, denied }: Props) {
  const hasOtherAccounts = useHasOtherAccounts();
  const home = useAccountHomeLink();
  // A record goes back to its own list (Consignments, Bids); any other page to the account's first.
  const back = denied.back ?? home;
  const subject = denied.page ? "It" : "This page";
  const reason = denied.openedBy
    ? undefined
    : hasOtherAccounts
      ? `${subject} isn't available in the account you're using. If it's in another of your accounts, switch to that one.`
      : `${subject} isn't available in your account. If someone sent you the link, check it with them.`;
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
