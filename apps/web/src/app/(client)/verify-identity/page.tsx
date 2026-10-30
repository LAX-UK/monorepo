import { VerifyIdentityClient } from "@/app/(client)/verify-identity/verify-identity-client";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { getServerKycStatusSummary } from "@/lib/data/http/kyc.server";
import { dashboardIdentityOnboardingHref } from "@/lib/kyc/identity-onboarding";
import { isIdentityOnboardingEnabled } from "@/lib/kyc/identity-onboarding-rollout.server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Verify identity",
};

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

/**
 * Identity checks live in the onboarding flow. This page remains only as the verifier for
 * deployments where that flow is switched off: `/onboarding/identity` sends people here in
 * that case, so redirecting unconditionally would loop.
 */
export default async function VerifyIdentityPage({ searchParams }: PageProps) {
  if (isIdentityOnboardingEnabled()) {
    const { next } = await searchParams;
    redirect(dashboardIdentityOnboardingHref(next));
  }
  const kyc = await getServerKycStatusSummary();
  return (
    <DashboardPage className="space-y-8">
      <SettingsFormHeader
        eyebrow="Identity"
        title="Verify your identity"
        description="Secure identity verification helps us protect buyers and sellers when bidding exposure reaches our threshold."
      />
      <VerifyIdentityClient initialStatus={kyc} />
    </DashboardPage>
  );
}
