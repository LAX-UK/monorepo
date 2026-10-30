import { shopIdentityBaseUrl } from "@/lib/shop-identity.server";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";
import { shopStorefrontRegisterHref } from "@/lib/shop-viewer-state";
import { safeLoginHint } from "@auction/identity-rp/safe-return-path";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageMetadata;

type ShopRegisterPageProps = {
  searchParams: Promise<{ returnTo?: string; loginHint?: string }>;
};

export default async function ShopRegisterPage({ searchParams }: ShopRegisterPageProps) {
  const params = await searchParams;
  redirect(
    `${shopIdentityBaseUrl()}${shopStorefrontRegisterHref(params.returnTo, {
      loginHint: safeLoginHint(params.loginHint),
    })}`,
  );
}
