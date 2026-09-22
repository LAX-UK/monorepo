import {
  ShopAccountBodyText,
  ShopAccountLinkButton,
  ShopAccountShell,
} from "@/components/account/shop-account-shell";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";

export const metadata = shopPrivatePageMetadata;

export default function ShopSignedOutPage() {
  return (
    <ShopAccountShell title="Signed out">
      <ShopAccountBodyText>Your Shop session has ended.</ShopAccountBodyText>
      <ShopAccountLinkButton href="/login?returnTo=%2F" label="Sign in again" />
    </ShopAccountShell>
  );
}
