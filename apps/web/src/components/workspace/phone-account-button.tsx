"use client";

import { personInitials } from "@/components/layout/account-menu/person-initials";
import { AccountSwitcherSheet } from "@/components/layout/account-switcher/account-switcher-sheet";
import { PersonAvatar } from "@/components/ui/person-avatar";
import type { SessionUser } from "@/lib/data/contracts";
import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { Button } from "@auction/ui/lax";
import { useState } from "react";

type Props = {
  user: Pick<SessionUser, "name" | "email" | "image">;
  switcher: NonNullable<AccountChrome["switcher"]>;
};

/**
 * The person's avatar in the phone bar. It opens the account sheet: every account to switch to,
 * pending invitations, then LAX Account and Sign out. The 44px target fits a thumb.
 */
export function PhoneAccountButton({ user, switcher }: Props) {
  const [open, setOpen] = useState(false);
  const name = user.name.trim() || user.email;
  return (
    <>
      <Button
        variant="ghost"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Your accounts, ${name}`}
        onClick={() => setOpen(true)}
        // The kit's ghost button, as a 44px circle around the 32px avatar.
        className="size-11 shrink-0 rounded-full p-0"
      >
        <PersonAvatar
          src={user.image}
          name={name}
          initials={personInitials(user.name, user.email)}
          className="size-8"
        />
      </Button>
      <AccountSwitcherSheet switcher={switcher} open={open} onOpenChange={setOpen} />
    </>
  );
}
