"use client";

import { personInitials } from "@/components/layout/account-menu/person-initials";
import { AccountButtonMark } from "@/components/layout/account-switcher/account-button-mark";
import { AccountSwitcherSheet } from "@/components/layout/account-switcher/account-switcher-sheet";
import type { SessionUser } from "@/lib/data/contracts";
import { accountButtonView } from "@/lib/navigation/account-button.vm";
import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { Button } from "@auction/ui/lax/button";
import { useState } from "react";

type Props = {
  user: Pick<SessionUser, "name" | "email" | "image">;
  /** The account in use. */
  current: AccountChrome["current"];
  switcher: NonNullable<AccountChrome["switcher"]>;
};

/**
 * The account button in the phone bar, showing the account in use: an organisation as its square
 * tile with the person's initials as a badge, the person's own account as their round avatar and
 * the word "Personal". It opens the "Switch account" sheet (every account, pending invitations,
 * then LAX Account and Sign out), in Personal as in an organisation. The 44px target fits a thumb.
 */
export function PhoneAccountButton({ user, current, switcher }: Props) {
  const [open, setOpen] = useState(false);
  const view = accountButtonView(current, {
    initials: personInitials(user.name, user.email),
    name: user.name.trim() || user.email,
  });
  return (
    <>
      <Button
        variant="ghost"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={view.label}
        data-testid="phone-account-button"
        onClick={() => setOpen(true)}
        // The kit's ghost button, 44px tall around a 32px tile or avatar.
        className="min-h-11 min-w-11 shrink-0 gap-2 rounded-lax-control px-1.5 font-normal"
      >
        <AccountButtonMark view={view} user={user} />
        {view.kind === "personal" ? (
          <span className="text-lax-13 font-medium text-lax-fg">{view.text}</span>
        ) : null}
      </Button>
      <AccountSwitcherSheet switcher={switcher} open={open} onOpenChange={setOpen} />
    </>
  );
}
