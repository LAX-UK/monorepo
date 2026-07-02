"use client";

import {
  signUpPersonaLabel,
  signUpPersonaSummary,
} from "@/lib/auth/sign-up-persona-options";
import type { SignupPersona } from "@auction/validators";
import { SelectionSummaryStrip } from "@auction/ui/components/selection-summary-strip";

type SignUpPersonaSummaryProps = {
  persona: SignupPersona;
  onChange: () => void;
};

export function SignUpPersonaSummary({ persona, onChange }: SignUpPersonaSummaryProps) {
  return (
    <SelectionSummaryStrip onChange={onChange}>
      Joining as <span className="font-medium">{signUpPersonaLabel(persona)}</span>
      <span className="text-on-surface-variant"> — {signUpPersonaSummary(persona)}</span>
    </SelectionSummaryStrip>
  );
}
