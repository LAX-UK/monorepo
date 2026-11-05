"use client";

import { ArtAuthLink } from "@/components/art-auth-link";
import { ArtMobileAuthSection } from "@/components/header/art-mobile-auth-section";
import { artSignInHref } from "@/lib/auth/art-reauth.vm";
import { ART_ACCOUNT_LINKS } from "@/lib/layout/art-account-nav.vm";
import { FOCUS_RING } from "@auction/branding";
import type { AccountChromeState, LaxProductLinkVm } from "@auction/lax-ecosystem";
import {
  MARKETING_HEADER_CHROME,
  MarketingAccountEntry,
  MarketingAccountSheet,
  MarketingChromeIconButton,
  type MarketingHeaderTone,
  MarketingUserIcon,
  headerChromeIconClass,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@auction/ui/components/dropdown-menu";
import Link from "next/link";
import { useRef, useState } from "react";

const ITEM = "min-h-11 cursor-pointer font-label text-sm font-medium text-on-surface";

type ArtAccountEntryProps = {
  account: AccountChromeState;
  productLinks: LaxProductLinkVm[];
  pathname: string;
  headerTone: MarketingHeaderTone;
  /** A reply to an enquiry is waiting. */
  replyDot: boolean;
};

function SignedInRows({
  account,
  productLinks,
}: {
  account: Extract<AccountChromeState, { kind: "authenticated" }>;
  productLinks: LaxProductLinkVm[];
}) {
  const signOutFormRef = useRef<HTMLFormElement>(null);
  const otherProducts = productLinks.filter((link) => !link.current);
  return (
    <>
      <form ref={signOutFormRef} action={account.logoutHref} method="post" hidden />
      <div className="border-b border-nav-border px-3 py-2">
        <p className="m-0 truncate font-body text-sm font-medium text-on-surface">
          {account.displayName || account.email}
        </p>
        {account.displayName && account.email ? (
          <p className="m-0 mt-0.5 truncate font-body text-xs text-on-surface-variant">
            {account.email}
          </p>
        ) : null}
      </div>
      <div className="py-1">
        <DropdownMenuItem asChild className={ITEM}>
          <Link href={account.accountHref}>My account</Link>
        </DropdownMenuItem>
        {ART_ACCOUNT_LINKS.map((link) => (
          <DropdownMenuItem key={link.href} asChild className={ITEM}>
            <Link href={link.href}>{link.label}</Link>
          </DropdownMenuItem>
        ))}
        {otherProducts.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="px-3 py-1.5 font-label text-xs font-medium text-on-surface-variant">
              LAX products
            </DropdownMenuLabel>
            {otherProducts.map((item) => (
              <DropdownMenuItem key={item.id} asChild className={ITEM}>
                <a href={item.href} rel="noopener noreferrer">
                  {item.label}
                </a>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={ITEM}
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

/**
 * The header's one account control. From 1024px it is `MarketingAccountEntry` ("Account" with a
 * guest menu, or avatar and first name); at 768-1023px it is an icon that opens the account
 * sheet, where a dropdown has too little room. Below 768px the bottom bar carries Account.
 */
export function ArtAccountEntry({
  account,
  productLinks,
  pathname,
  headerTone,
  replyDot,
}: ArtAccountEntryProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  if (account.kind === "disabled" || account.kind === "unavailable") return null;

  const signedIn = account.kind === "authenticated";
  const sheetTitle = signedIn ? account.displayName || "Account" : "Account";

  return (
    <>
      <div className="hidden lg:block" data-testid="art-header-desktop-account">
        <MarketingAccountEntry
          viewer={signedIn ? { displayName: account.displayName, email: account.email } : null}
          signInHref={artSignInHref(pathname)}
          createAccountHref={account.kind === "guest" ? account.registerHref : "/register"}
          menuItems={
            signedIn ? <SignedInRows account={account} productLinks={productLinks} /> : null
          }
          attention={replyDot}
          headerTone={headerTone}
          renderAuthLink={({ href, className, children }) => (
            <ArtAuthLink href={href} className={className}>
              {children}
            </ArtAuthLink>
          )}
        />
      </div>
      <div className="relative lg:hidden" data-testid="art-header-tablet-account">
        <MarketingChromeIconButton
          label={replyDot ? "Account, new reply" : "Account"}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
          className={cn(MARKETING_HEADER_CHROME, headerChromeIconClass(headerTone), FOCUS_RING)}
        >
          <MarketingUserIcon className="size-5" aria-hidden />
        </MarketingChromeIconButton>
        {replyDot ? (
          <span
            aria-hidden
            data-testid="account-entry-attention"
            className="absolute top-2 right-2 size-2 rounded-full bg-danger"
          />
        ) : null}
        <MarketingAccountSheet open={sheetOpen} onOpenChange={setSheetOpen} title={sheetTitle}>
          <ArtMobileAuthSection
            account={account}
            pathname={pathname}
            onNavigate={() => setSheetOpen(false)}
          />
        </MarketingAccountSheet>
      </div>
    </>
  );
}
