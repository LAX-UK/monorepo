import { VerifyIdentityClient } from "@/app/dashboard/verify-identity/verify-identity-client";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { getServerKycStatusSummary } from "@/lib/data/http/kyc.server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify identity",
};

export default async function VerifyIdentityPage() {
  const kyc = await getServerKycStatusSummary();
  return (
    <DashboardPage className="space-y-8">
      <SettingsFormHeader
        eyebrow="Identity"
        title="Verify your identity"
        hideTitleOnMobile
        description="Secure identity verification helps us protect buyers and sellers when bidding exposure reaches our threshold."
      />
      <VerifyIdentityClient initialStatus={kyc} />
    </DashboardPage>
  );
}
