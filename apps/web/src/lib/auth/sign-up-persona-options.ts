import type { RadioCardOption } from "@auction/ui/components/radio-card-group";
import type { WizardProgressStep } from "@auction/ui/components/wizard-progress";
import type { SignupPersona } from "@auction/validators";

export const SIGN_UP_WIZARD_STEPS: readonly WizardProgressStep[] = [
  { id: "persona", label: "Account type" },
  { id: "details", label: "Your details" },
];

export const SIGN_UP_PERSONA_OPTIONS: readonly RadioCardOption[] = [
  {
    value: "individual",
    label: "An individual",
    description: "Bid and buy on your own behalf.",
  },
  {
    value: "organisation",
    label: "Representing a gallery, dealer, or estate",
    description: "Sell and consign on behalf of an organisation.",
  },
];

export function signUpPersonaLabel(persona: SignupPersona): string {
  return persona === "organisation" ? "Organisation" : "Individual";
}

export function signUpPersonaSummary(persona: SignupPersona): string {
  return persona === "organisation" ? "Representing a gallery, dealer, or estate" : "An individual";
}
