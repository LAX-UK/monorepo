import { shopIdentityBaseUrl } from "@/lib/shop-identity.server";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageMetadata;

export default function ShopRegisterPage() {
  redirect(`${shopIdentityBaseUrl()}/register`);
}
