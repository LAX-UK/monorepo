"use client";

import { useAccountChrome } from "@/components/layout/account-switcher/account-chrome-context";
import { AccountSwitcherPopover } from "@/components/layout/account-switcher/account-switcher-popover";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { ChevronDown, Loader2 } from "lucide-react";
import Link from "next/link";

type Props = {
  /** The page's name: "You don't have access to Bids". */
  label: string;
  /** Who can open it: "Owners, admins and buyer agents". */
  openedBy: string;
  /** The page's own address, so switching account lands back on it. */
  next: string;
};

/**
 * A workspace page the member's role does not open, reached by its address. It names the page and
 * who can open it, and offers the way back: Home, or another account that can.
 */
export function WorkspacePageNoAccess({ label, openedBy, next }: Props) {
  const switcher = useAccountChrome()?.switcher ?? null;
  return (
    <EmptyState
      size="page"
      variant="plain"
      headingLevel="h1"
      illustration="lock"
      title={`You don't have access to ${label}`}
      description={`${openedBy} can open it. Ask one of them if you need something here.`}
      action={
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href={CLIENT_ROUTES.home}>Back to Home</Link>
          </Button>
          {switcher ? (
            <AccountSwitcherPopover
              switcher={switcher}
              align="center"
              destination={next}
              trigger={(pendingId) => (
                <Button variant="secondaryOutline" aria-busy={pendingId !== null || undefined}>
                  {pendingId ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Switch account
                  <ChevronDown className="size-4" strokeWidth={1.75} aria-hidden />
                </Button>
              )}
            />
          ) : null}
        </div>
      }
    />
  );
}
