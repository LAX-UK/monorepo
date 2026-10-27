"use client";

import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { Button } from "@auction/ui/components/button";
import { useState } from "react";
import { AccountSwitcherSheet } from "./account-switcher-sheet";
import { AccountTile } from "./account-tile";

type Props = {
  account: AccountChrome;
};

/**
 * On phones the menu sits behind More, so the header also carries the account's tile: one tap
 * opens the switcher. Shown only while using an organisation (a personal tile would repeat the
 * avatar), and hidden from the desktop breakpoint, where the switcher heads the sidebar.
 */
export function AccountHeaderButton({ account }: Props) {
  const [open, setOpen] = useState(false);
  const { switcher, current } = account;
  // A personal account's tile would repeat the avatar beside it; the menu sheet still switches.
  if (!switcher || current.kind !== "organisation") return null;
  return (
    <>
      <Button
        variant="ghost"
        size="link"
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Account: ${current.name}, ${current.detail}. Switch account`}
        data-testid="account-header-button"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-surface-container-high lg:hidden"
      >
        <AccountTile account={current} />
      </Button>
      <AccountSwitcherSheet switcher={switcher} open={open} onOpenChange={setOpen} />
    </>
  );
}
