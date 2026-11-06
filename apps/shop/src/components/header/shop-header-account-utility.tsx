"use client";

import { ShopAccountStatus } from "@/components/header/shop-account-status";
import { SHOP_ORDERS_HREF } from "@/lib/account/shop-account-routes";
import { laxAccountUrl } from "@/lib/lax-account-url";
import { shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import type { AccountChromeState } from "@auction/lax-ecosystem";
import { MarketingAccountEntry, type MarketingHeaderTone } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { DropdownMenuItem, DropdownMenuSeparator } from "@auction/ui/components/dropdown-menu";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

const ROW = "min-h-11 cursor-pointer font-label text-sm font-medium";

/** The rows of the signed-in menu: who is signed in, then Your orders, settings and Sign out. */
function ShopSignedInRows({
  displayName,
  email,
  logoutHref,
  onNavigate,
}: {
  displayName: string;
  email: string;
  logoutHref: string;
  onNavigate?: (() => void) | undefined;
}) {
  const signOutFormRef = useRef<HTMLFormElement>(null);
  const navigate = onNavigate ? { onClick: onNavigate } : {};
  return (
    <>
      <form ref={signOutFormRef} action={logoutHref} method="post" hidden />
      <div className="border-b border-nav-border px-3 py-2 dark:border-border-hairline">
        <p className="m-0 truncate font-body text-sm font-medium text-on-surface">{displayName}</p>
        {email ? (
          <p className="m-0 mt-0.5 truncate font-body text-xs text-on-surface-variant">{email}</p>
        ) : null}
      </div>
      <div className="py-1">
        <DropdownMenuItem asChild className={cn(ROW)}>
          <Link href={SHOP_ORDERS_HREF} {...navigate}>
            Your orders
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={cn(ROW)}>
          <a href={laxAccountUrl()} {...navigate}>
            LAX Account settings
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={cn(ROW)}
          onSelect={(event) => {
            event.preventDefault();
            signOutFormRef.current?.requestSubmit();
          }}
        >
          Sign out
        </DropdownMenuItem>
      </div>
    </>
  );
}

type ShopHeaderAccountUtilityProps = {
  account: AccountChromeState;
  headerTone?: MarketingHeaderTone;
  /** A dot on the entry while an order needs the person. */
  attention?: boolean;
  onNavigate?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Shop's account control in the header row: "Account" with the guest menu when signed out, the
 * avatar and first name when signed in. A disabled or unavailable account shows its status.
 */
export function ShopHeaderAccountUtility({
  account,
  headerTone = "on-light",
  attention = false,
  onNavigate,
  open,
  onOpenChange,
}: ShopHeaderAccountUtilityProps) {
  const pathname = usePathname();
  const control = {
    ...(open !== undefined ? { open } : {}),
    ...(onOpenChange ? { onOpenChange } : {}),
  };
  switch (account.kind) {
    case "authenticated":
      return (
        <MarketingAccountEntry
          viewer={{ displayName: account.displayName, email: account.email }}
          signInHref="/login"
          createAccountHref="/register"
          attention={attention}
          headerTone={headerTone}
          menuItems={
            <ShopSignedInRows
              displayName={account.displayName}
              email={account.email}
              logoutHref={account.logoutHref}
              onNavigate={onNavigate}
            />
          }
          {...control}
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
        <MarketingAccountEntry
          viewer={null}
          signInHref={shopStorefrontLoginHref(pathname || "/")}
          createAccountHref={account.registerHref}
          headerTone={headerTone}
          {...control}
        />
      );
  }
}
