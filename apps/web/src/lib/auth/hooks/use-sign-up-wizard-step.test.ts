import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import type { SignUpFormValues } from "@/lib/auth/schemas";
import { useSignUpWizardStep } from "./use-sign-up-wizard-step";

function renderWizardStep(initialStep: "persona" | "details" = "persona") {
  const { result: formResult } = renderHook(() =>
    useForm<SignUpFormValues>({
      defaultValues: {
        firstName: "",
        lastName: "",
        email: "",
        phone: { country: "GB", number: "" },
        password: "",
        persona: "individual",
        acceptTerms: false,
      },
    }),
  );
  const { result } = renderHook(() =>
    useSignUpWizardStep(formResult.current, initialStep),
  );
  return { form: formResult.current, wizard: result };
}

describe("useSignUpWizardStep", () => {
  it("starts on persona by default", () => {
    const { wizard } = renderWizardStep();
    expect(wizard.current.step).toBe("persona");
  });

  it("goToDetails advances when persona is valid", async () => {
    const { wizard } = renderWizardStep();
    await act(async () => {
      await wizard.current.goToDetails();
    });
    expect(wizard.current.step).toBe("details");
  });

  it("backToPersona returns to persona step", () => {
    const { wizard } = renderWizardStep("details");
    act(() => {
      wizard.current.backToPersona();
    });
    expect(wizard.current.step).toBe("persona");
  });
});
