"use client";

import { AuthStepShell } from "@/components/auth/primitives/auth-step-shell";
import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { SignUpFields } from "@/components/auth/sign-up-fields";
import { SignUpInviteBanner } from "@/components/auth/sign-up-invite-banner";
import { SignUpLegalConsent } from "@/components/auth/sign-up-legal-consent";
import { SignUpOrgNextSteps } from "@/components/auth/sign-up-org-next-steps";
import { SignUpPersonaSummary } from "@/components/auth/sign-up-persona-summary";
import { SocialSignInButtons } from "@/components/auth/social-sign-in-buttons";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import type { SignUpFormValues } from "@/lib/auth/schemas";
import { SIGN_UP_WIZARD_STEPS } from "@/lib/auth/sign-up-persona-options";
import type { SignUpInvitePreview } from "@/lib/auth/sign-up-types";
import { AuthOrDivider } from "@auction/ui/components/auth-or-divider";
import { type Control, useWatch } from "react-hook-form";

type SignUpDetailsStepProps = {
  control: Control<SignUpFormValues>;
  phoneDefaultCountry?: string;
  lockedEmail?: string;
  showPersonaSummary: boolean;
  onChangePersona: () => void;
  showWizardProgress: boolean;
  isInvite: boolean;
  invitePreview?: SignUpInvitePreview;
  next: string;
  loginHref: string;
  loading: boolean;
  turnstileReady: boolean;
  turnstileSiteKey: string | undefined;
  onTurnstileToken: (token: string) => void;
  onTurnstileExpire: () => void;
};

export function SignUpDetailsStep({
  control,
  phoneDefaultCountry = "GB",
  lockedEmail,
  showPersonaSummary,
  onChangePersona,
  showWizardProgress,
  isInvite,
  invitePreview,
  next,
  loginHref,
  loading,
  turnstileReady,
  turnstileSiteKey,
  onTurnstileToken,
  onTurnstileExpire,
}: SignUpDetailsStepProps) {
  const persona = useWatch({ control, name: "persona" });

  return (
    <AuthStepShell
      {...(showWizardProgress ? { wizardSteps: SIGN_UP_WIZARD_STEPS, currentStepIndex: 1 } : {})}
      title="Your account details"
      visuallyHiddenTitle
    >
      <SignUpInviteBanner isInvite={isInvite} {...(invitePreview ? { invitePreview } : {})} />
      {showPersonaSummary && persona ? (
        <SignUpPersonaSummary persona={persona} onChange={onChangePersona} />
      ) : null}
      {persona === "organisation" ? <SignUpOrgNextSteps /> : null}
      <SignUpFields
        control={control}
        phoneDefaultCountry={phoneDefaultCountry}
        {...(lockedEmail ? { lockedEmail } : {})}
      />
      <SignUpLegalConsent control={control} />
      <TurnstileWidget
        siteKey={turnstileSiteKey}
        onToken={onTurnstileToken}
        onClear={onTurnstileExpire}
      />
      {!isInvite ? (
        <div className="flex flex-col gap-6">
          <AuthOrDivider />
          <SocialSignInButtons next={next} />
        </div>
      ) : null}
      <div className="flex flex-col gap-6">
        <AuthSubmitButton loading={loading} loadingLabel="Signing up…" disabled={!turnstileReady}>
          {isInvite ? "Accept invitation & sign up" : "Sign Up"}
        </AuthSubmitButton>
        <AuthFooterLink prefix="Already have an account?" linkText="Log in" href={loginHref} />
      </div>
    </AuthStepShell>
  );
}
