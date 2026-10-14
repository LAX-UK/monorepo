import {
  ShopAccountBodyText,
  ShopAccountLinkButton,
  ShopAccountShell,
} from "@/components/account/shop-account-shell";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";
import { shopStorefrontLoginHref } from "@/lib/shop-viewer-state";

export const metadata = shopPrivatePageMetadata;

type ShopSessionExpiredPageProps = {
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function ShopSessionExpiredPage({
  searchParams,
}: ShopSessionExpiredPageProps) {
  const { returnTo } = await searchParams;
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
      <ShopAccountLinkButton
        href={shopStorefrontLoginHref(typeof returnTo === "string" ? returnTo : "/account")}
        label="Sign in again"
      />
      <ShopAccountLinkButton href="/artworks" label="Continue browsing" variant="outline" />
    </ShopAccountShell>
  );
}
