"use client";

import { ArtAuthLink } from "@/components/art-auth-link";
import { artSignInHref } from "@/lib/auth/art-reauth.vm";
import { ART_ACCOUNT_LINKS } from "@/lib/layout/art-account-nav.vm";
import type { AccountChromeState, LaxProductLinkVm } from "@auction/lax-ecosystem";
import {
  type MarketingAccountNavItem,
  MarketingAuthenticatedAccountMenu,
  MarketingGuestAccountMenu,
  type MarketingHeaderTone,
} from "@auction/marketing-ui";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const ART_ACCOUNT_NAV: MarketingAccountNavItem[] = [...ART_ACCOUNT_LINKS];

type ArtHeaderAccountMenuProps = {
  account: AccountChromeState;
  productLinks: LaxProductLinkVm[];
  headerTone: MarketingHeaderTone;
};

export function ArtHeaderAccountMenu({
  account,
  productLinks,
  headerTone,
}: ArtHeaderAccountMenuProps) {
  const pathname = usePathname();

  switch (account.kind) {
    case "guest":
      return (
        <MarketingGuestAccountMenu
          headerTone={headerTone}
          loginHref={artSignInHref(pathname)}
          registerHref={account.registerHref}
          renderLoginLink={({
            href,
            className,
            children,
          }: {
            href: string;
            className: string;
            children: ReactNode;
          }) => (
            <ArtAuthLink href={href} className={className}>
              {children}
            </ArtAuthLink>
          )}
          renderRegisterLink={({
            href,
            className,
            children,
          }: {
            href: string;
            className: string;
            children: ReactNode;
          }) => (
            <ArtAuthLink href={href} className={className}>
              {children}
            </ArtAuthLink>
          )}
        />
      );
    case "authenticated":
      return (
        <MarketingAuthenticatedAccountMenu
          headerTone={headerTone}
          displayName={account.displayName}
          email={account.email}
          accountHref={account.accountHref}
          logoutHref={account.logoutHref}
          navItems={ART_ACCOUNT_NAV}
          productLinks={productLinks}
        />
      );
    case "disabled":
    case "unavailable":
      return null;
  }
}
