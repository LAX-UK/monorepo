"use client";

import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import type { ReactElement } from "react";
import { useState } from "react";
import { useAccountNeedsYou } from "./account-needs-you";
import { AccountSwitcherList } from "./account-switcher-list";
import { useAccountSwitch } from "./use-account-switch";

type Props = {
  switcher: NonNullable<AccountChrome["switcher"]>;
  /** The control that opens the list; it receives the pending account while a switch runs. */
  trigger: (pendingId: string | null) => ReactElement;
  side?: "bottom" | "right";
  align?: "start" | "center";
  /** Where to go after switching; the new account's Home by default. */
  destination?: string;
};

/** The account list in a popover, opened by any trigger. */
export function AccountSwitcherPopover({
  switcher,
  trigger,
  side = "bottom",
  align = "start",
  destination,
}: Props) {
  const [open, setOpen] = useState(false);
  const { pendingId, choose } = useAccountSwitch(destination);
  // Pointing at or focusing the trigger reads the dots, so they are there when the list opens.
  const { request } = useAccountNeedsYou();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onPointerEnter={request} onFocus={request}>
        {trigger(pendingId)}
      </PopoverTrigger>
      <PopoverContent
        aria-label="Switch account"
        align={align}
        side={side}
        sideOffset={6}
        className="w-[19rem] rounded-lax-menu border-lax-line bg-lax-raised p-1 text-lax-fg shadow-lax-md"
      >
        <AccountSwitcherList
          switcher={switcher}
          pendingId={pendingId}
          onChoose={(option) => {
            setOpen(false);
            void choose(option);
          }}
          onNavigate={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
