"use client";

import { ArtAuthLink } from "@/components/art-auth-link";
import { ArtGeneralEnquirySheet } from "@/components/enquiry/art-general-enquiry-sheet.client";
import { ArtHeaderAccountMenu } from "@/components/header/art-header-account-menu";
import { artSignInHref } from "@/lib/auth/art-reauth.vm";
import { FOCUS_RING } from "@auction/branding";
import type { AccountChromeState, LaxProductLinkVm } from "@auction/lax-ecosystem";
import { headerProductLinkClass } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

const ACTION_CLASS = cn(
  headerProductLinkClass("on-light", false),
  "inline-flex min-h-11 items-center rounded-sm",
  FOCUS_RING,
);

type ArtHeaderUtilityActionsProps = {
  account: AccountChromeState;
  productLinks: LaxProductLinkVm[];
  pathname: string;
};

/**
 * Right side of the utility row (Figma `521:7889`): Log in, or the account menu once signed in,
 * then Enquire. Signed-in viewers send a general enquiry from the sheet with their details
 * prefilled; everyone else is taken to /contact, where guests can write to the gallery too.
 */
export function ArtHeaderUtilityActions({
  account,
  productLinks,
  pathname,
}: ArtHeaderUtilityActionsProps) {
  const loginHref = artSignInHref(pathname);

  return (
    <>
      {account.kind === "guest" ? (
        <ArtAuthLink href={loginHref} className={ACTION_CLASS}>
          Log in
        </ArtAuthLink>
      ) : (
        <div data-testid="art-header-desktop-account">
          <ArtHeaderAccountMenu account={account} productLinks={productLinks} />
        </div>
      )}
      {account.kind === "authenticated" ? (
        <ArtGeneralEnquirySheet
          contact={{
            name: account.displayName,
            email: account.email,
            phone: account.verifiedPhone ?? "",
          }}
          renderTrigger={(open) => (
            <Button type="button" variant="link" className={ACTION_CLASS} onClick={open}>
              Enquire
            </Button>
          )}
        />
      ) : (
        <Link href="/contact" className={ACTION_CLASS}>
          Enquire
        </Link>
      )}
    </>
  );
}
