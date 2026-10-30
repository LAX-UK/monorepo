"use client";

import { ArtAuthLink } from "@/components/art-auth-link";
import { ArtGeneralEnquirySheet } from "@/components/enquiry/art-general-enquiry-sheet.client";
import { ArtHeaderAccountMenu } from "@/components/header/art-header-account-menu";
import { artSignInHref } from "@/lib/auth/art-reauth.vm";
import { FOCUS_RING } from "@auction/branding";
import type { AccountChromeState, LaxProductLinkVm } from "@auction/lax-ecosystem";
import { type MarketingHeaderTone, headerProductLinkClass } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

const actionClass = (headerTone: MarketingHeaderTone) =>
  cn(
    headerProductLinkClass(headerTone, false, "normal-case tracking-normal"),
    "inline-flex min-h-11 items-center rounded-sm",
    FOCUS_RING,
  );

type ArtHeaderUtilityActionsProps = {
  account: AccountChromeState;
  productLinks: LaxProductLinkVm[];
  pathname: string;
  headerTone: MarketingHeaderTone;
};

/**
 * Right side of the utility row (Figma `521:7889`): Sign in, or the account menu once signed in,
 * then Enquire. Signed-in viewers send a general enquiry from the sheet with their details
 * prefilled; everyone else is taken to /contact, where guests can write to the gallery too.
 */
export function ArtHeaderUtilityActions({
  account,
  productLinks,
  pathname,
  headerTone,
}: ArtHeaderUtilityActionsProps) {
  const actionClassName = actionClass(headerTone);
  const loginHref = artSignInHref(pathname);

  return (
    <>
      {account.kind === "guest" ? (
        <ArtAuthLink href={loginHref} className={actionClassName}>
          Sign in
        </ArtAuthLink>
      ) : (
        <div data-testid="art-header-desktop-account">
          <ArtHeaderAccountMenu
            account={account}
            productLinks={productLinks}
            headerTone={headerTone}
          />
        </div>
      )}
      {account.kind === "authenticated" ? (
        <ArtGeneralEnquirySheet
          viewerKind="authenticated"
          contact={{
            name: account.displayName,
            email: account.email,
            phone: account.verifiedPhone ?? "",
          }}
          renderTrigger={(open) => (
            <Button type="button" variant="link" className={actionClassName} onClick={open}>
              Enquire
            </Button>
          )}
        />
      ) : (
        <Link href="/contact" className={actionClassName}>
          Enquire
        </Link>
      )}
    </>
  );
}
