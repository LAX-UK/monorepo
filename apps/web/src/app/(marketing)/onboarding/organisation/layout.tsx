import { OrgOnboardingShell } from "@/app/(marketing)/onboarding/organisation/org-onboarding-shell";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";

export const metadata: Metadata = metadataForPrivate(
  "Organisation onboarding",
  "Set up your organisation to consign with LAX.",
);

export default async function OrganisationOnboardingLayout({ children }: { children: ReactNode }) {
  await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/onboarding/organisation",
  });

  return (
    <main id="main-content" className="min-h-screen bg-surface">
      <div className="border-b border-outline-variant/20 bg-surface-container-low/40 py-6">
        <div className="container mx-auto max-w-3xl px-4">
          <h1 className="text-3xl font-semibold text-on-surface">Submit to LAX</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Set up your gallery, dealer, or estate. You can leave any time—progress is saved to your
            dashboard.
          </p>
        </div>
      </div>
      <Suspense fallback={<div className="container mx-auto max-w-3xl px-4 py-10">Loading…</div>}>
        <OrgOnboardingShell>{children}</OrgOnboardingShell>
      </Suspense>
    </main>
  );
}
