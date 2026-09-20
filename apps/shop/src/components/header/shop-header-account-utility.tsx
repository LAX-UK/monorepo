"use client";

import { ShopAccountStatus } from "@/components/header/shop-account-status";
import {
  ShopAuthenticatedAccountMenu,
  ShopGuestAccountMenu,
} from "@/components/header/shop-header-account-menu";
import type { AccountChromeState, LaxProductLinkVm } from "@auction/lax-ecosystem";
import type { MarketingHeaderTone } from "@auction/marketing-ui";

export function ShopHeaderAccountUtility({
  account,
  productLinks = [],
  headerTone = "on-light",
  onNavigate,
  open,
  onOpenChange,
}: {
  account: AccountChromeState;
  productLinks?: LaxProductLinkVm[];
  headerTone?: MarketingHeaderTone;
  onNavigate?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const menuControl =
    open !== undefined || onOpenChange
      ? { ...(open !== undefined ? { open } : {}), ...(onOpenChange ? { onOpenChange } : {}) }
      : {};
  switch (account.kind) {
    case "authenticated":
      return (
        <ShopAuthenticatedAccountMenu
          displayName={account.displayName}
          email={account.email}
          accountHref={account.accountHref}
          logoutHref={account.logoutHref}
          productLinks={productLinks}
          headerTone={headerTone}
          {...menuControl}
          {...(onNavigate ? { onNavigate } : {})}
        />
      );
    case "disabled":
      return (
        <ShopAccountStatus
          kind="disabled"
          detailMessage={account.message}
          {...(account.accountHref ? { accountHref: account.accountHref } : {})}
          {...(onNavigate ? { onNavigate } : {})}
        />
      );
    case "unavailable":
      return (
        <ShopAccountStatus
          kind="unavailable"
          detailMessage={account.message}
          {...(onNavigate ? { onNavigate } : {})}
        />
      );
    default:
      return (
        <ShopGuestAccountMenu
          loginHref={account.loginHref}
          registerHref={account.registerHref}
          headerTone={headerTone}
          {...menuControl}
          {...(onNavigate ? { onNavigate } : {})}
        />
      );
  }
}
