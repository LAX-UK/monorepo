"use client";

import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import type { ReactElement } from "react";
import { useState } from "react";
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
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger(pendingId)}</PopoverTrigger>
      <PopoverContent
        aria-label="Switch account"
        align={align}
        side={side}
        sideOffset={6}
        className="w-[19rem] rounded-xl bg-surface-container-lowest p-0 shadow-lg"
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
