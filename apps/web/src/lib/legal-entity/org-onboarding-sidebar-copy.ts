import { orgDocumentsStepIntro } from "@/lib/legal-entity/org-onboarding-documents-copy";
import type { OrgOnboardingStepKey } from "@auction/types";
import type { PublicOrganisationSubkind } from "@auction/validators";

export type OrgOnboardingSidebarSection = {
  stepKey: OrgOnboardingStepKey;
  title: string;
  items: readonly string[];
};

const BASE_SECTIONS: Record<OrgOnboardingStepKey, Omit<OrgOnboardingSidebarSection, "stepKey">> = {
  type: {
    title: "Organisation type",
    items: [
      "Choose the category that best describes how you sell or consign art.",
      "You can change this only before completing this step.",
    ],
  },
  details: {
    title: "Business details",
    items: [
      "Trading or display name and registered legal name",
      "Primary business address",
      "VAT number when applicable",
    ],
  },
  documents: {
    title: "Supporting documents",
    items: [],
  },
  connect: {
    title: "Payout setup",
    items: [
      "Stripe Connect account for secure payouts",
      "Bank account details verified by Stripe",
      "Business representative information",
    ],
  },
  identity: {
    title: "Identity verification",
    items: [
      "Photo ID for authorised representatives",
      "Verification may continue after you submit",
      "We will email you if anything else is needed",
    ],
  },
};

function documentItemsForSubkind(subkind: PublicOrganisationSubkind | null): string[] {
  if (!subkind) {
    return ["Proof of registration and identity documents (requirements depend on entity type)"];
  }
  return [orgDocumentsStepIntro(subkind)];
}

/** Checklist sections for the onboarding sidebar, keyed by wizard step. */
export function orgOnboardingSidebarSections(
  subkind: PublicOrganisationSubkind | null,
): OrgOnboardingSidebarSection[] {
  return (Object.keys(BASE_SECTIONS) as OrgOnboardingStepKey[]).map((stepKey) => {
    const base = BASE_SECTIONS[stepKey];
    const items = stepKey === "documents" ? documentItemsForSubkind(subkind) : [...base.items];
    return { stepKey, title: base.title, items };
  });
}
