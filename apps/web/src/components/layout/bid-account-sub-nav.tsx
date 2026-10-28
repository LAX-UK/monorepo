"use client";

import { buildAccountSubNav } from "@/lib/navigation/account-sub-nav.vm";
import type { ClientNavScope } from "@/lib/navigation/client-nav-model";
import { useAccountMenuContext } from "@/lib/navigation/use-account-menu-context.client";
import { AccountSubNav } from "@auction/marketing-ui";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

type BidAccountSubNavProps = {
  userId: string;
  scope: ClientNavScope;
  initials: string;
};

/** Bid's "Your account" row under the public header, with counts where something is due. */
export function BidAccountSubNav({ userId, scope, initials }: BidAccountSubNavProps) {
  const pathname = usePathname() ?? "";
  const context = useAccountMenuContext(userId, true);
  const vm = useMemo(
    () => buildAccountSubNav({ scope, pathname, attention: context?.attention ?? null }),
    [scope, pathname, context],
  );
  return (
    <AccountSubNav
      label="Your account"
      initials={initials}
      items={vm.items}
      currentId={vm.currentId}
    />
  );
}
