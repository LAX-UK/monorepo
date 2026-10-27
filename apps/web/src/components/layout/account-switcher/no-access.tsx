"use client";

import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { ChevronDown, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAccountChrome } from "./account-chrome-context";
import { AccountSwitcherPopover } from "./account-switcher-popover";

type Props = {
  /** The page the person tried to open; switching takes them back to it. */
  next: string;
};

/**
 * "You don't have access": a link to a record of an account the person cannot use. Someone with
 * more than one account can switch from here and land back on the same page.
 */
export function NoAccess({ next }: Props) {
  const switcher = useAccountChrome()?.switcher ?? null;
  return (
    <EmptyState
      size="page"
      variant="plain"
      headingLevel="h1"
      illustration="lock"
      title="You don't have access"
      description={
        switcher
          ? "This page belongs to an account you aren't using. Switch to the account it belongs to, or ask its owner to invite you."
          : "This page belongs to an organisation you aren't a member of. Ask its owner to invite you."
      }
      action={
        <div className="flex flex-wrap items-center justify-center gap-3">
          {switcher ? (
            <AccountSwitcherPopover
              switcher={switcher}
              align="center"
              destination={next}
              trigger={(pendingId) => (
                <Button disabled={pendingId !== null} data-testid="no-access-switch">
                  {pendingId ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Switch account
                  <ChevronDown className="size-4" strokeWidth={1.75} aria-hidden />
                </Button>
              )}
            />
          ) : null}
          <Button asChild variant="secondaryOutline">
            <Link href={CLIENT_ROUTES.bids}>Go to My bids</Link>
          </Button>
        </div>
      }
    />
  );
}
