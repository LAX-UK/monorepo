import { shopIdentityBaseUrl } from "@/lib/shop-identity.server";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";
import { shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { safeLoginHint } from "@auction/identity-rp/safe-return-path";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageMetadata;

type ShopLoginPageProps = {
  searchParams: Promise<{ returnTo?: string; loginHint?: string }>;
};

export default async function ShopLoginPage({ searchParams }: ShopLoginPageProps) {
  const params = await searchParams;
  redirect(
    `${shopIdentityBaseUrl()}${shopStorefrontLoginHref(params.returnTo, {
      loginHint: safeLoginHint(params.loginHint),
    })}`,
  );
}
