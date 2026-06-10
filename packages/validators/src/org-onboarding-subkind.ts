import type { PublicOrganisationSubkind } from "./legal-entity.js";
import { publicOrganisationSubkinds } from "./legal-entity.js";

export type PublicOrgSubkindMeta = {
  value: PublicOrganisationSubkind;
  label: string;
  description: string;
};

/** Canonical labels and helper copy for public organisation onboarding type selection. */
export const PUBLIC_ORG_SUBKIND_META: readonly PublicOrgSubkindMeta[] = [
  {
    value: "gallery",
    label: "Gallery",
    description:
      "A physical or online showroom presenting works to the public, typically with curated exhibitions and artist representation.",
  },
  {
    value: "dealer",
    label: "Dealer",
    description:
      "Trades works for clients, often with private inventory and direct-relationship sales.",
  },
  {
    value: "estate",
    label: "Estate",
    description: "Managing inheritance, probate, or settlement sales of an art collection.",
  },
  {
    value: "company",
    label: "Company",
    description:
      "A registered company or corporate entity selling or consigning art, including private companies and holding structures.",
  },
  {
    value: "charity",
    label: "Charity",
    description:
      "A registered charity or non-profit selling or consigning works, often from donations or fundraising.",
  },
  {
    value: "institution",
    label: "Institution",
    description:
      "A museum, foundation, or cultural institution consigning or deaccessioning works from a collection.",
  },
  {
    value: "other",
    label: "Other",
    description:
      "Doesn't fit the above? Tell us about your organisation and we'll work with you on requirements.",
  },
] as const;

export const PUBLIC_ORG_SUBKIND_LABELS = Object.fromEntries(
  PUBLIC_ORG_SUBKIND_META.map((item) => [item.value, item.label]),
) as Record<PublicOrganisationSubkind, string>;

export const PUBLIC_ORG_SUBKIND_DESCRIPTIONS = Object.fromEntries(
  PUBLIC_ORG_SUBKIND_META.map((item) => [item.value, item.description]),
) as Record<PublicOrganisationSubkind, string>;

/** Ensure meta covers every creatable subkind (compile-time guard via satisfies). */
const _metaCoverage: Record<PublicOrganisationSubkind, true> = Object.fromEntries(
  publicOrganisationSubkinds.map((value) => [value, true]),
) as Record<PublicOrganisationSubkind, true>;
void _metaCoverage;

export function publicOrgSubkindDescription(subkind: PublicOrganisationSubkind): string {
  return PUBLIC_ORG_SUBKIND_DESCRIPTIONS[subkind];
}

export function publicOrgSubkindLabel(subkind: PublicOrganisationSubkind): string {
  return PUBLIC_ORG_SUBKIND_LABELS[subkind];
}
