import { shopIdentityBaseUrl } from "@/lib/shop-identity.server";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";

export const metadata = shopPrivatePageMetadata;
import { redirect } from "next/navigation";

type ShopLoginPageProps = {
  searchParams: Promise<{ returnTo?: string }>;
};

export default async function ShopLoginPage({ searchParams }: ShopLoginPageProps) {
  const params = await searchParams;
  const returnTo =
    typeof params.returnTo === "string" &&
    params.returnTo.startsWith("/") &&
    !params.returnTo.startsWith("//")
      ? params.returnTo
      : undefined;
  const base = `${shopIdentityBaseUrl()}/login`;
  redirect(returnTo ? `${base}?returnTo=${encodeURIComponent(returnTo)}` : base);
}
