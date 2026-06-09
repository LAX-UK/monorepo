"use client";

import { RHFInput } from "@/components/auth/primitives/rhf-input";
import { SocialSignInButtons } from "@/components/auth/social-sign-in-buttons";
import type { SignInFormValues } from "@/lib/auth/schemas";
import { Button } from "@auction/ui/components/button";
import type { Control } from "react-hook-form";

type SignInEmailStepProps = {
  control: Control<SignInFormValues>;
  onContinue: () => void;
  next: string;
};

export function SignInEmailStep({ control, onContinue, next }: SignInEmailStepProps) {
  return (
    <>
      <div className="flex flex-col gap-6">
        <SocialSignInButtons next={next} />
        <div className="flex items-center gap-4 text-on-surface-variant" aria-hidden>
          <span className="h-px flex-1 bg-outline-variant/40" />
          <span className="font-footer-links text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]">
            or
          </span>
          <span className="h-px flex-1 bg-outline-variant/40" />
        </div>
      </div>
      <RHFInput
        control={control}
        name="email"
        label="Email Address"
        type="email"
        autoComplete="username"
      />
      <Button
        type="button"
        variant="cta"
        size="xl"
        className="font-headline shadow-none"
        onClick={onContinue}
      >
        Continue
      </Button>
    </>
  );
}
