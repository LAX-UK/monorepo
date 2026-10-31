"use client";

import { Button } from "@auction/ui/lax";
import { ChevronDown, Loader2 } from "lucide-react";
import { useAccountChrome } from "./account-chrome-context";
import { AccountSwitcherPopover } from "./account-switcher-popover";

type Props = {
  /** Where switching lands: the page the person tried to open. */
  destination: string;
  /** `primary` when switching is the way on; `secondary` beside "Back to Home". */
  emphasis: "primary" | "secondary";
};

/**
 * "Switch account" on an access page, for someone with more than one account; switching takes
 * them back to the page they tried to open. Renders nothing for someone with one account.
 */
export function SwitchAccountAction({ destination, emphasis }: Props) {
  const switcher = useAccountChrome()?.switcher ?? null;
  if (!switcher) return null;
  return (
    <AccountSwitcherPopover
      switcher={switcher}
      align="center"
      destination={destination}
      trigger={(pendingId) => (
        <Button
          variant={emphasis === "primary" ? "primary" : "secondary"}
          aria-busy={pendingId !== null || undefined}
          data-testid="no-access-switch"
        >
          {pendingId ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Switch account
          <ChevronDown strokeWidth={1.75} aria-hidden />
        </Button>
      )}
    />
  );
}

/** Whether the person has another account to switch to. */
export function useHasOtherAccounts(): boolean {
  return (useAccountChrome()?.switcher ?? null) !== null;
}
