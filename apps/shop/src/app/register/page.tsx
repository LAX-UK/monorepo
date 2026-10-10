import { shopIdentityBaseUrl } from "@/lib/shop-identity.server";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";
import { safeRelativeReturnPath } from "@auction/identity-rp";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageMetadata;

type ShopRegisterPageProps = {
  searchParams: Promise<{ returnTo?: string }>;
};

export default async function ShopRegisterPage({ searchParams }: ShopRegisterPageProps) {
  const returnTo = safeRelativeReturnPath((await searchParams).returnTo);
  const base = `${shopIdentityBaseUrl()}/register`;
  redirect(returnTo ? `${base}?returnTo=${encodeURIComponent(returnTo)}` : base);
}
