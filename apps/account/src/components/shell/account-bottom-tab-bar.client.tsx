"use client";

import type { AccountNavId, AccountNavItemVm } from "@/server/domain/account-nav.vm";
import { MarketingBottomTabBar, MarketingMoreIcon } from "@auction/marketing-ui";
import { usePathname } from "next/navigation";
import { type ReactNode, useMemo } from "react";
import { buildAccountBottomTabs } from "./account-bottom-tabs";
import { openAccountMenu } from "./account-menu-events";
import { AccountNavIcon } from "./account-nav-icons";

function tabIcon(navId: AccountNavId | undefined): ReactNode {
  return navId ? (
    <AccountNavIcon id={navId} className="size-6" />
  ) : (
    <MarketingMoreIcon className="size-6" />
  );
}

/**
 * LAX Account's docked phone tab bar: Home, Portfolio, Money and More. More opens the same menu
 * sheet as the header button, so there is no second set of destinations. The bar hides itself
 * while the sheet or any dialog is open and while the keyboard is up, so only one bar shows.
 */
export function AccountBottomTabBar({ items }: { items: AccountNavItemVm[] }) {
  const pathname = usePathname() ?? "";
  const tabs = useMemo(
    () =>
      buildAccountBottomTabs(items, pathname).map((tab) => {
        const icon = tabIcon(tab.navId);
        const base = { key: tab.key, label: tab.label, icon, paths: tab.paths };
        return tab.href ? { ...base, href: tab.href } : { ...base, action: "menu" as const };
      }),
    [items, pathname],
  );
  return (
    <MarketingBottomTabBar
      tabs={tabs}
      pathname={pathname}
      onMenu={openAccountMenu}
      accent="var(--color-product-accent)"
      ariaLabel="LAX Account shortcuts"
      data-testid="account-bottom-tab-bar"
    />
  );
}
