"use client";

import { AuthStepShell } from "@/components/auth/primitives/auth-step-shell";
import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import type { SignUpFormValues } from "@/lib/auth/schemas";
import { SIGN_UP_PERSONA_OPTIONS, SIGN_UP_WIZARD_STEPS } from "@/lib/auth/sign-up-persona-options";
import { RadioCardGroup } from "@auction/ui/components/radio-card-group";
import { WizardNav } from "@auction/ui/components/wizard-nav";
import { type Control, Controller } from "react-hook-form";

type SignUpPersonaStepProps = {
  control: Control<SignUpFormValues>;
  onContinue: () => void;
  loginHref: string;
};

export function SignUpPersonaStep({ control, onContinue, loginHref }: SignUpPersonaStepProps) {
  return (
    <AuthStepShell
      wizardSteps={SIGN_UP_WIZARD_STEPS}
      currentStepIndex={0}
      title="How are you joining?"
    >
      <Controller
        control={control}
        name="persona"
        render={({ field, fieldState }) => (
          <RadioCardGroup
            legend="I'm joining as…"
            hideLegend
            value={field.value}
            onValueChange={field.onChange}
            options={SIGN_UP_PERSONA_OPTIONS}
            inputRef={field.ref}
            {...(fieldState.error?.message ? { error: fieldState.error.message } : {})}
          />
        )}
      />
      <div className="flex flex-col gap-6">
        <WizardNav
          isFirst
          isLast={false}
          onBack={() => undefined}
          onNext={onContinue}
          nextStepLabel="Your details"
        />
        <AuthFooterLink prefix="Already have an account?" linkText="Log in" href={loginHref} />
      </div>
    </AuthStepShell>
  );
}
