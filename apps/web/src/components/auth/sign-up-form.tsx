"use client";

import { SellAuthIntentBanner } from "@/components/auth/sell-auth-intent-banner";
import { SignUpDetailsStep } from "@/components/auth/sign-up-details-step";
import { SignUpPersonaStep } from "@/components/auth/sign-up-persona-step";
import { buildAuthHref } from "@/lib/auth/auth-route-links";
import { useSignUpController } from "@/lib/auth/hooks/use-sign-up-controller";
import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import type { SignUpInvitePreview } from "@/lib/auth/sign-up-types";
import { rememberPendingEntityInviteAction } from "@/lib/legal-entity/pending-invite-cookie.actions";
import { Form } from "@auction/ui/components/form";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export type { SignUpInvitePreview } from "@/lib/auth/sign-up-types";

type Props = {
  inviteToken?: string;
  /** Server-resolved invite details; locks the email and hides persona choice. */
  invitePreview?: SignUpInvitePreview;
  orgModuleEnabled?: boolean;
  phoneDefaultCountry?: string;
};

export function SignUpForm({
  inviteToken,
  invitePreview,
  orgModuleEnabled = true,
  phoneDefaultCountry = "GB",
}: Props) {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const safeNext = rawNext && isSafeNextPath(rawNext) ? rawNext : undefined;
  const next = safeNext ?? "/dashboard";
  const sellIntent = searchParams.get("intent") === "sell";
  const loginHref = buildAuthHref("/login", {
    ...(safeNext !== undefined ? { next: safeNext } : {}),
  });
  const forgotPasswordHref = buildAuthHref("/forgot-password", {
    ...(safeNext !== undefined ? { next: safeNext } : {}),
  });
  const isInvite = Boolean(inviteToken);
  const showPersonaChoice = orgModuleEnabled && !isInvite;
  const startAtDetails = isInvite || !showPersonaChoice;
  const controllerOpts = {
    ...(inviteToken ? { inviteToken } : {}),
    ...(invitePreview?.email ? { defaultEmail: invitePreview.email } : {}),
    ...(safeNext ? { next: safeNext } : {}),
    loginHref,
    forgotPasswordHref,
    phoneDefaultCountry,
    ...(sellIntent ? { sellIntent: true } : {}),
    initialStep: startAtDetails ? ("details" as const) : ("persona" as const),
  };
  const {
    form,
    onSubmit,
    loading,
    step,
    goToDetails,
    backToPersona,
    turnstileSiteKey,
    turnstileReady,
    onTurnstileToken,
    onTurnstileExpire,
  } = useSignUpController(controllerOpts);

  // Entity (organisation) invites are accepted post-verification via cookie;
  // platform invites are consumed during registration and need no cookie.
  useEffect(() => {
    if (!inviteToken || !orgModuleEnabled) return;
    if (invitePreview && !invitePreview.entityScoped) return;
    void rememberPendingEntityInviteAction(inviteToken);
  }, [inviteToken, orgModuleEnabled, invitePreview]);

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="flex w-full flex-col gap-10" noValidate>
        <SellAuthIntentBanner />
        {step === "persona" ? (
          <SignUpPersonaStep
            control={form.control}
            onContinue={() => void goToDetails()}
            loginHref={loginHref}
          />
        ) : (
          <SignUpDetailsStep
            control={form.control}
            phoneDefaultCountry={phoneDefaultCountry}
            {...(invitePreview?.email ? { lockedEmail: invitePreview.email } : {})}
            showPersonaSummary={showPersonaChoice}
            onChangePersona={backToPersona}
            showWizardProgress={showPersonaChoice}
            isInvite={isInvite}
            {...(invitePreview ? { invitePreview } : {})}
            next={next}
            loginHref={loginHref}
            loading={loading}
            turnstileReady={turnstileReady}
            turnstileSiteKey={turnstileSiteKey}
            onTurnstileToken={onTurnstileToken}
            onTurnstileExpire={onTurnstileExpire}
          />
        )}
      </form>
    </Form>
  );
}
