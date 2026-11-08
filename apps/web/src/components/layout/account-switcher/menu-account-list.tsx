"use client";

import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { AccountSwitcherList, type WrapItem } from "./account-switcher-list";
import { useAccountSwitch } from "./use-account-switch";

type Props = {
  switcher: NonNullable<AccountChrome["switcher"]>;
  /** Called when a link in the list is followed, so the menu can close. */
  onNavigate: () => void;
  /** Inside a dropdown, wraps each row as the dropdown's own item. */
  wrapItem?: WrapItem;
};

/**
 * The accounts inside an account menu: the one switcher list, with the switch run in place so the
 * chosen row shows its progress and a failure shows under the rows. The menu's own links replace
 * the list's footer links.
 */
export function MenuAccountList({ switcher, onNavigate, wrapItem }: Props) {
  const { pendingId, failure, choose, retry } = useAccountSwitch(undefined, "inline");
  return (
    <AccountSwitcherList
      switcher={switcher}
      pendingId={pendingId}
      // Stays open: the chosen row shows the progress, and a failure shows under the rows.
      onChoose={(option) => void choose(option)}
      onNavigate={onNavigate}
      failure={failure}
      onRetry={() => void retry()}
      withLinks={false}
      {...(wrapItem ? { wrapItem } : {})}
    />
  );
}
