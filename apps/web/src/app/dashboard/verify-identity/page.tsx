import { VerifyIdentityClient } from "@/app/dashboard/verify-identity/verify-identity-client";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify identity",
};

export default function VerifyIdentityPage() {
  return (
    <DashboardPage className="space-y-8">
      <SettingsFormHeader
        eyebrow="Identity"
        title="Verify your identity"
        description="We use Stripe Identity to confirm who you are when your bidding exposure reaches our threshold."
      />
      <VerifyIdentityClient />
    </DashboardPage>
  );
}
