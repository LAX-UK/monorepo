import { shopIdentityBaseUrl } from "@/lib/shop-identity.server";
import { redirect } from "next/navigation";

export default function ShopLoginPage() {
  redirect(`${shopIdentityBaseUrl()}/login`);
}
