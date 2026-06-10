import { OrgOnboardingShellServer } from "@/app/(task)/onboarding/organisation/org-onboarding-shell.server";
import { OrgOnboardingLoadingSkeleton } from "@/components/onboarding/org-onboarding-loading-skeleton";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { resolveOrgOnboardingLoginNext } from "@/lib/legal-entity/org-onboarding-request-path.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense } from "react";

export const metadata: Metadata = metadataForPrivate(
  "Organisation onboarding",
  "Set up your organisation to consign with LAX.",
);

export default async function OrganisationOnboardingLayout({ children }: { children: ReactNode }) {
  const orgModuleEnabled = await resolveOrgModuleEnabledFromRequest();
  if (!orgModuleEnabled) {
    redirect("/dashboard/organisations");
  }

  const loginNext = await resolveOrgOnboardingLoginNext();

  await requireAuthenticatedUser({
    shell: "client",
    loginNext,
  });

  return (
    <main id="main-content" className="min-h-screen bg-surface">
      <div className="border-b border-border-hairline bg-surface-container-low/40 py-4 lg:py-6">
        <div className="container mx-auto max-w-6xl px-4">
          <h1 className="text-2xl font-semibold text-on-surface lg:text-3xl">Submit to LAX</h1>
          <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
            Set up your gallery, dealer, or estate. Progress is saved — use{" "}
            <strong className="text-on-surface">Finish later</strong> to return to your{" "}
            <span className="text-on-surface">Organisations</span> hub any time.
          </p>
        </div>
      </div>
      <Suspense fallback={<OrgOnboardingLoadingSkeleton />}>
        <OrgOnboardingShellServer>{children}</OrgOnboardingShellServer>
      </Suspense>
    </main>
  );
}
