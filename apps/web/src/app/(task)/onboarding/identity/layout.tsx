import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { isFullBuyerOnboardingEnabled } from "@/lib/kyc/full-buyer-onboarding-rollout.server";
import { legacyKycVerificationHref } from "@/lib/kyc/identity-onboarding";
import { resolveIdentityOnboardingRequestPath } from "@/lib/kyc/identity-onboarding-request-path.server";
import { isIdentityOnboardingEnabled } from "@/lib/kyc/identity-onboarding-rollout.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const metadata: Metadata = metadataForPrivate(
  "Identity onboarding",
  "Prepare for and complete secure identity verification.",
);

export default async function IdentityOnboardingLayout({ children }: { children: ReactNode }) {
  const requestPath = await resolveIdentityOnboardingRequestPath();
  const requestUrl = new URL(requestPath, "https://onboarding.internal");
  const requestedNext = requestUrl.searchParams.get("next");
  const isFullFlowContinuation =
    (requestUrl.searchParams.get("source") === "post_verify" ||
      requestUrl.searchParams.get("source") === "sign_in_resume") &&
    isFullBuyerOnboardingEnabled();

  if (!isIdentityOnboardingEnabled() && !isFullFlowContinuation) {
    redirect(legacyKycVerificationHref(requestedNext));
  }

  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: requestPath,
  });

  if (user.signupPersona === "organisation") {
    redirect("/onboarding/organisation");
  }

  return <div className="min-h-[calc(100vh-3.5rem)] bg-page-bg dark:bg-background">{children}</div>;
}
