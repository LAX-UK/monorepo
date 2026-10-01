import {
  ShopAccountBodyText,
  ShopAccountLinkButton,
  ShopAccountShell,
} from "@/components/account/shop-account-shell";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { Suspense } from "react";
import { SignedOutUrlCleanup } from "./signed-out-url.client";

export const metadata = shopPrivatePageTitle("Signed out");

export default function ShopSignedOutPage() {
  return (
    <ShopAccountShell title="Signed out">
      <Suspense fallback={null}>
        <SignedOutUrlCleanup />
      </Suspense>
      <ShopAccountBodyText>Your Shop session has ended.</ShopAccountBodyText>
      <ShopAccountLinkButton href="/login?returnTo=%2F" label="Sign in again" />
    </ShopAccountShell>
  );
}
