import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { resolveBuyerOnboardingRequestPath } from "@/lib/onboarding/buyer-onboarding-request-path.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const metadata: Metadata = metadataForPrivate(
  "Choose your interests",
  "Personalise your LAX auction recommendations.",
);

export default async function BuyerInterestsLayout({ children }: { children: ReactNode }) {
  const requestPath = await resolveBuyerOnboardingRequestPath();
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: requestPath,
  });
  if (user.signupPersona === "organisation") redirect("/onboarding/organisation");
  return children;
}
