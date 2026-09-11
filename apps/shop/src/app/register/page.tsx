import { identityPublicBaseUrl } from "@/lib/identity-public.server";
import { redirect } from "next/navigation";

export default function ShopRegisterPage() {
  redirect(`${identityPublicBaseUrl()}/sign-up`);
}
