"use client";

import { useLogout } from "@/lib/auth/use-logout";
import { laxAccountHomeUrl } from "@/lib/lax-account-url";
import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { cn } from "@auction/ui";
import { Button, Dialog } from "@auction/ui/lax";
import { ArrowUpRight, LogOut, UserRound } from "lucide-react";
import { AccountSwitcherList, SWITCHER_ROW } from "./account-switcher-list";
import { useAccountSwitch } from "./use-account-switch";

type Props = {
  switcher: NonNullable<AccountChrome["switcher"]>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const ROW = cn(SWITCHER_ROW, "min-h-11");

/** The person's own rows under the accounts: LAX Account, then signing out. */
function PersonRows({ onNavigate }: { onNavigate: () => void }) {
  const { logout, pending } = useLogout({ onBeforeNavigate: onNavigate });
  return (
    <>
      <a href={laxAccountHomeUrl()} onClick={onNavigate} className={ROW}>
        <UserRound aria-hidden strokeWidth={1.75} />
        <span className="flex-1">LAX Account</span>
        <span aria-hidden className="text-lax-muted">
          <ArrowUpRight className="size-3.5" strokeWidth={1.75} />
        </span>
        <span className="sr-only"> (opens LAX Account)</span>
      </a>
      <Button variant="ghost" onClick={() => void logout()} disabled={pending} className={ROW}>
        <LogOut aria-hidden strokeWidth={1.75} />
        {pending ? "Signing out…" : "Sign out"}
      </Button>
    </>
  );
}

/**
 * The account sheet on a phone: the same list as the desktop switcher (filter, dots,
 * invitations), with 60px account rows for thumbs, then LAX Account and Sign out. It rises from
 * the bottom like the More sheet, through the kit's dialog.
 */
export function AccountSwitcherSheet({ switcher, open, onOpenChange }: Props) {
  const { pendingId, choose } = useAccountSwitch();
  const close = () => onOpenChange(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Switch account">
      <AccountSwitcherList
        switcher={switcher}
        pendingId={pendingId}
        density="sheet"
        onChoose={(option) => {
          close();
          void choose(option);
        }}
        onNavigate={close}
        footer={<PersonRows onNavigate={close} />}
      />
    </Dialog>
  );
}
