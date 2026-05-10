import { OrganisationOnboardingForm } from "@/components/legal-entity/organization-onboarding-form";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { PublicOrganisationSubkind } from "@auction/validators";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Submit to LAX",
  "Set up an organisation to consign with LAX.",
);

type SubkindOption = { value: PublicOrganisationSubkind; label: string };

async function loadSubkinds(): Promise<SubkindOption[]> {
  const res = await authedServerFetch("/organizations/subkinds", { cache: "no-store" });
  if (!res.ok) return [];
  const body = (await res.json()) as { data: SubkindOption[] };
  return body.data;
}

export default async function OrganisationOnboardingPage() {
  await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/onboarding/organisation",
  });
  const subkinds = await loadSubkinds();

  return (
    <main id="main-content" className="container mx-auto max-w-2xl py-12">
      <h1 className="text-3xl font-semibold">Submit to LAX</h1>
      <p className="mt-2 text-on-surface-variant">
        Set up your gallery, dealer, estate, or institution to consign with LAX. We will guide you
        through verification and Stripe Connect onboarding.
      </p>
      <div className="mt-8">
        <OrganisationOnboardingForm subkinds={subkinds} />
      </div>
    </main>
  );
}
