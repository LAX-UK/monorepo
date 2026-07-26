import type { WizardStepSpec } from "@/components/admin/admin-form-wizard/step-indicator";
import { catalogWizardStepValidationBanner } from "@/lib/admin/catalog-form-step-copy";
import type { ArtistFormValues } from "./types";

/** Artist setup wizard step ids, in order. */
export const ARTIST_SETUP_STEP_IDS = [
  "kind",
  "identity",
  "biography",
  "departments",
  "review",
] as const;

export type ArtistSetupStepId = (typeof ARTIST_SETUP_STEP_IDS)[number];

/** Step specs consumed by {@link WizardStepIndicator}. */
export const ARTIST_SETUP_STEPS: readonly WizardStepSpec[] = [
  {
    id: "kind",
    label: "Kind",
    subItems: ["Profile type"],
  },
  {
    id: "identity",
    label: "Identity",
    subItems: ["Display name", "Dates", "User link"],
  },
  {
    id: "biography",
    label: "Biography",
    subItems: ["Copy", "Media", "Website"],
  },
  {
    id: "departments",
    label: "Departments",
    subItems: ["Categories", "Attributes"],
  },
  {
    id: "review",
    label: "Review",
    subItems: ["Status", "Visibility"],
  },
];

/**
 * Per-step field groups validated by {@link validateWizardStep} before advancing.
 * Field names mirror `adminArtistBodyObject` in `@auction/validators`. The
 * `attributes` entry on the Departments step lets the kind-aware `superRefine`
 * surface per-kind attribute errors on that step.
 */
export const ARTIST_STEP_FIELD_GROUPS: (keyof ArtistFormValues)[][] = [
  ["kind"],
  [
    "displayName",
    "nationality",
    "location",
    "countryCode",
    "birthYear",
    "deathYear",
    "foundedYear",
    "dissolvedYear",
    "ownerUserId",
  ],
  ["shortBio", "longBio", "statement", "portraitUrl", "heroImageUrl", "websiteUrl"],
  ["categoryIds", "attributes"],
  ["status", "featured", "verified", "archived"],
];

export function artistSetupStepId(index: number): ArtistSetupStepId {
  const clamped = Math.max(0, Math.min(index, ARTIST_SETUP_STEP_IDS.length - 1));
  return ARTIST_SETUP_STEP_IDS[clamped] ?? "kind";
}

export function artistSetupStepLabel(stepIndex: number): string {
  const step = ARTIST_SETUP_STEPS[stepIndex];
  return step?.label ?? "this step";
}

export function artistSetupWizardValidationMessage(stepIndex: number | null): string {
  if (stepIndex == null) return catalogWizardStepValidationBanner();
  return catalogWizardStepValidationBanner(artistSetupStepLabel(stepIndex));
}
