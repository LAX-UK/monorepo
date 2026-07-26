import type { SignupPersona } from "@auction/validators";

/** Categorical palette keys — one per displayed signup persona (CSS in globals.css). */
export type SignupPersonaPaletteKey = "individual" | "organisation" | "unset";

/** Semantic icon keys resolved by the badge component (no Lucide import here). */
export type SignupPersonaIconKey = "user" | "building" | "help";

export type SignupPersonaPresentation = {
  /** Short label for badges and compact UI. */
  label: string;
  /** Full accessible name. */
  ariaLabel: string;
  paletteKey: SignupPersonaPaletteKey;
  iconKey: SignupPersonaIconKey;
};

/** Filter value for admin user lists — includes synthetic "none" for unset. */
export type SignupPersonaFilterValue = SignupPersona | "none";

const INDIVIDUAL_PRESENTATION: SignupPersonaPresentation = {
  label: "Individual",
  ariaLabel: "Individual signup persona",
  paletteKey: "individual",
  iconKey: "user",
};

const ORGANISATION_PRESENTATION: SignupPersonaPresentation = {
  label: "Organisation",
  ariaLabel: "Organisation signup persona",
  paletteKey: "organisation",
  iconKey: "building",
};

const UNSET_PRESENTATION: SignupPersonaPresentation = {
  label: "Not set",
  ariaLabel: "Signup persona not set",
  paletteKey: "unset",
  iconKey: "help",
};

const PRESENTATION_BY_VALUE: Record<SignupPersona, SignupPersonaPresentation> = {
  individual: INDIVIDUAL_PRESENTATION,
  organisation: ORGANISATION_PRESENTATION,
};

function isSignupPersona(value: string): value is SignupPersona {
  return value === "individual" || value === "organisation";
}

/** Resolve stored or raw persona value into badge copy, palette, and icon key. */
export function resolveSignupPersonaPresentation(
  persona: SignupPersona | string | null | undefined,
): SignupPersonaPresentation {
  if (persona == null || persona === "") {
    return UNSET_PRESENTATION;
  }
  if (isSignupPersona(persona)) {
    return PRESENTATION_BY_VALUE[persona];
  }
  return UNSET_PRESENTATION;
}

/** Human-readable label for admin lists and detail fields (compatibility). */
export function formatSignupPersona(persona: SignupPersona | string | null | undefined): string {
  return resolveSignupPersonaPresentation(persona).label;
}

/** Label for admin filter chips and select options. */
export function signupPersonaFilterLabel(value: SignupPersonaFilterValue): string {
  if (value === "none") {
    return UNSET_PRESENTATION.label;
  }
  return resolveSignupPersonaPresentation(value).label;
}

export const signupPersonaFilterOptions: { value: SignupPersonaFilterValue; label: string }[] = [
  { value: "individual", label: INDIVIDUAL_PRESENTATION.label },
  { value: "organisation", label: ORGANISATION_PRESENTATION.label },
  { value: "none", label: UNSET_PRESENTATION.label },
];

export const signupPersonaPaletteKeys: SignupPersonaPaletteKey[] = [
  "individual",
  "organisation",
  "unset",
];
