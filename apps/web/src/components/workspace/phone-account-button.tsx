"use client";

import { personInitials } from "@/components/layout/account-menu/person-initials";
import { AccountSwitcherSheet } from "@/components/layout/account-switcher/account-switcher-sheet";
import { AccountTile } from "@/components/layout/account-switcher/account-tile";
import { PersonAvatar } from "@/components/ui/person-avatar";
import type { SessionUser } from "@/lib/data/contracts";
import { accountButtonView } from "@/lib/navigation/account-button.vm";
import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { Button } from "@auction/ui/lax";
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
  const name = user.name.trim() || user.email;
  const initials = personInitials(user.name, user.email);
  const view = accountButtonView(current, { initials });
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
        {view.kind === "organisation" ? (
          <span className="relative inline-flex">
            <AccountTile account={{ kind: "organisation", initials: view.tileInitials }} />
            <span
              aria-hidden
              className="absolute -right-1.5 -bottom-1.5 inline-flex size-5 items-center justify-center rounded-full bg-lax-neutral-bg font-lax text-lax-12 leading-none font-semibold tracking-tight text-lax-fg ring-2 ring-lax-page"
            >
              {view.badgeInitials}
            </span>
          </span>
        ) : (
          <>
            <PersonAvatar src={user.image} name={name} initials={initials} className="size-8" />
            <span className="text-lax-13 font-medium text-lax-fg">{view.text}</span>
          </>
        )}
      </Button>
      <AccountSwitcherSheet switcher={switcher} open={open} onOpenChange={setOpen} />
    </>
  );
}
