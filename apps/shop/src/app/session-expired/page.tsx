import {
  ShopAccountBodyText,
  ShopAccountLinkButton,
  ShopAccountShell,
} from "@/components/account/shop-account-shell";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";

export const metadata = shopPrivatePageMetadata;

export default function ShopSessionExpiredPage() {
  return (
    <ShopAccountShell
      title="Session expired"
      notice={{
        variant: "warning",
        title: "Sign in again",
        description: "Your Shop session timed out for your security.",
      }}
    >
      <ShopAccountBodyText>Pick up where you left off after signing in.</ShopAccountBodyText>
      <ShopAccountLinkButton href="/login?returnTo=%2Faccount" label="Sign in" />
    </ShopAccountShell>
  );
}
