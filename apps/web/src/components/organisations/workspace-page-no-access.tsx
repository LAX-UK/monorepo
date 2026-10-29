"use client";

import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { SwitchAccountAction } from "@/components/layout/account-switcher/switch-account-action";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { AccessDeniedState } from "@auction/ui/components/access-denied-state";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  /** The page's name: "You don't have access to Bids". */
  label: string;
  /** Who can open it, from the capability table: "Owners, admins and buyer agents". */
  openedBy: string | null;
  /** The page's own address, so switching account lands back on it. */
  next: string;
  /** Leave out the page column when the caller already renders inside one. */
  inPage?: boolean;
};

/**
 * A workspace page the member's role does not open, reached by its address. It names the page and
 * who can open it, and offers the way back: Home, or another account that can.
 */
export function WorkspacePageNoAccess({ label, openedBy, next, inPage = false }: Props) {
  const state = (
    <AccessDeniedState
      page={label}
      openedBy={openedBy}
      actions={
        <>
          <Button asChild>
            <Link href={CLIENT_ROUTES.home}>Back to Home</Link>
          </Button>
          <SwitchAccountAction destination={next} emphasis="secondary" />
        </>
      }
    />
  );
  return inPage ? state : <DashboardPage>{state}</DashboardPage>;
}
