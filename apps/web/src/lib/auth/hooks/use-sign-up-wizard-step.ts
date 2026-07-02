"use client";

import { useCallback, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { SignUpFormValues } from "@/lib/auth/schemas";
import type { SignUpWizardStep } from "@/lib/auth/sign-up-types";

/** Wizard step navigation for sign-up — isolated from submit/turnstile concerns. */
export function useSignUpWizardStep(
  form: UseFormReturn<SignUpFormValues>,
  initialStep: SignUpWizardStep = "persona",
) {
  const [step, setStep] = useState<SignUpWizardStep>(initialStep);

  const goToDetails = useCallback(async () => {
    const valid = await form.trigger("persona");
    if (!valid) return;
    setStep("details");
  }, [form]);

  const backToPersona = useCallback(() => {
    setStep("persona");
  }, []);

  return { step, goToDetails, backToPersona };
}
