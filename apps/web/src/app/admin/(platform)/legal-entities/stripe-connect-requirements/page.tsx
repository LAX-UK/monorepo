import { redirect } from "next/navigation";

/** Stripe requirements now live on the legal entities lookup page. */
export default async function AdminStripeConnectRequirementsPage() {
  redirect("/admin/legal-entities?stripe=1");
}
