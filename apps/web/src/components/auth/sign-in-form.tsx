"use client";

import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import { SignInCredentialsStep } from "@/components/auth/sign-in-credentials-step";
import { SignInEmailStep } from "@/components/auth/sign-in-email-step";
import { SignInPhoneForm } from "@/components/auth/sign-in-phone-form";
import {
  SignInAuthedLoadingSkeleton,
  SignInAuthedPanel,
} from "@/components/auth/sign-in/sign-in-authed-panel";
import { SignInBanners } from "@/components/auth/sign-in/sign-in-banners";
import { SignInLegacyPasswordForm } from "@/components/auth/sign-in/sign-in-legacy-password-form";
import {
  readSignInFlashMessages,
  useSignInQueryCleanup,
} from "@/components/auth/sign-in/use-sign-in-query-cleanup";
import { buildAuthHref, parseAuthEmailParam } from "@/lib/auth/auth-route-links";
import { useSignInController } from "@/lib/auth/hooks/use-sign-in-controller";
import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { socialErrorMessage } from "@/lib/auth/social-error-message";
import { useAppSession } from "@/lib/auth/use-app-session";
import { sellRegisterHrefFromSubmissionNext } from "@/lib/marketing/sell-intake";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

type SignInFormProps = {
  /** When true (e.g. `/login?switch=1`), show sign-out to use another account. */
  switchAccount?: boolean;
};

export function SignInForm({ switchAccount = false }: SignInFormProps) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const [signInMode, setSignInMode] = useState<"email" | "phone">("email");
  const sellIntent = searchParams.get("intent") === "sell";
  const prefillEmail = parseAuthEmailParam(searchParams.get("email"));
  const flash = readSignInFlashMessages(searchParams);
  useSignInQueryCleanup();

  const {
    form,
    onSubmit,
    loading,
    bannerError,
    showCaptcha,
    signInSubmitDisabled,
    turnstileSiteKey,
    onTurnstileToken,
    onTurnstileExpire,
    emailFirst,
    step,
    goToCredentials,
    changeEmail,
    requestMagicLink,
    resendMagicLink,
    linkSent,
    linkCooldown,
    magicLinkLoading,
    magicLinkError,
    magicLinkTurnstileReady,
    onMagicLinkTurnstileToken,
    onMagicLinkTurnstileExpire,
  } = useSignInController(next, {
    sellIntent,
    ...(prefillEmail ? { prefillEmail } : {}),
    ...(prefillEmail ? { initialStep: "credentials" as const } : {}),
  });

  const socialError = flash.socialErrorMessage
    ? socialErrorMessage(flash.socialErrorMessage)
    : null;

  const { user, pending } = useAppSession();
  const emailValue = form.watch("email");
  const safeNext = isSafeNextPath(next) ? next : undefined;
  const registerHref = buildAuthHref("/register", {
    ...(safeNext !== undefined ? { next: safeNext } : {}),
  });
  const sellRegisterHref =
    sellIntent && safeNext
      ? sellRegisterHrefFromSubmissionNext(safeNext)
      : sellRegisterHrefFromSubmissionNext("/dashboard/submissions/new");
  const forgotPasswordHref = buildAuthHref("/forgot-password", {
    ...(safeNext !== undefined ? { next: safeNext } : {}),
    ...(emailValue ? { email: emailValue } : {}),
  });

  const banners = (
    <SignInBanners
      registered={flash.registered}
      reset={flash.reset}
      authRequired={flash.authRequired}
      verifyPending={flash.verifyPending}
      sessionExpired={flash.sessionExpired}
      twofaRequired={flash.twofaRequired}
      bannerError={bannerError}
      socialError={socialError}
    />
  );

  if (switchAccount && pending) {
    return <SignInAuthedLoadingSkeleton />;
  }

  if (switchAccount && user?.email) {
    return <SignInAuthedPanel user={user} next={next} switchAccount />;
  }

  if (!switchAccount && user?.email && !pending) {
    return (
      <SignInAuthedPanel
        user={user}
        next={next}
        {...(safeNext !== undefined ? { safeNext } : {})}
      />
    );
  }

  const credentialsStepProps = {
    control: form.control,
    email: emailValue,
    next,
    forgotPasswordHref,
    loading,
    signInSubmitDisabled,
    showCaptcha,
    turnstileSiteKey,
    onTurnstileToken,
    onTurnstileExpire,
    onChangeEmail: changeEmail,
    linkSent,
    linkCooldown,
    magicLinkLoading,
    magicLinkError,
    magicLinkTurnstileReady,
    onMagicLinkTurnstileToken,
    onMagicLinkTurnstileExpire,
    onRequestMagicLink: () => void requestMagicLink(),
    onResendMagicLink: () => void resendMagicLink(),
  };

  const credentialsStepWithSell = (
    <SignInCredentialsStep
      {...credentialsStepProps}
      sellIntent={sellIntent}
      sellRegisterHref={sellRegisterHref}
    />
  );

  const credentialsStepPlain = <SignInCredentialsStep {...credentialsStepProps} />;

  if (!emailFirst) {
    if (signInMode === "phone") {
      return (
        <div className="flex w-full flex-col gap-10">
          {banners}
          <SignInPhoneForm
            nextHref={isSafeNextPath(next) ? next : "/dashboard"}
            next={next}
            onUseEmail={() => setSignInMode("email")}
          />
        </div>
      );
    }

    return (
      <SignInLegacyPasswordForm
        control={form.control}
        onSubmit={onSubmit}
        loading={loading}
        signInSubmitDisabled={signInSubmitDisabled}
        showCaptcha={showCaptcha}
        turnstileSiteKey={turnstileSiteKey}
        onTurnstileToken={onTurnstileToken}
        onTurnstileExpire={onTurnstileExpire}
        forgotPasswordHref={forgotPasswordHref}
        sellIntent={sellIntent}
        sellRegisterHref={sellRegisterHref}
        registerHref={registerHref}
        next={next}
        banners={banners}
        onUsePhone={() => setSignInMode("phone")}
      />
    );
  }

  if (signInMode === "phone") {
    return (
      <div className="flex w-full flex-col gap-10">
        {banners}
        <SignInPhoneForm
          nextHref={isSafeNextPath(next) ? next : "/dashboard"}
          next={next}
          onUseEmail={() => setSignInMode("email")}
        />
      </div>
    );
  }

  if (linkSent) {
    return (
      <div className="flex w-full flex-col gap-10">
        {banners}
        {credentialsStepPlain}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-10" noValidate>
      {banners}
      {step === "email" ? (
        <>
          <SignInEmailStep control={form.control} onContinue={goToCredentials} next={next} />
          <Button
            type="button"
            variant="link"
            size="link"
            className="font-footer-links text-sm"
            onClick={() => setSignInMode("phone")}
          >
            Sign in with phone number
          </Button>
          {!sellIntent ? (
            <AuthFooterLink
              prefix="Don't have an account?"
              linkText="Sign up"
              href={registerHref}
            />
          ) : (
            <p className="text-center font-footer-links text-sm text-on-surface-variant">
              New to LAX?{" "}
              <Link
                href={sellRegisterHref}
                className="text-link underline-offset-2 hover:underline"
              >
                Create an account
              </Link>{" "}
              to start your submission in about 3 minutes.
            </p>
          )}
        </>
      ) : (
        <>
          {credentialsStepWithSell}
          <Button
            type="button"
            variant="link"
            size="link"
            className="font-footer-links text-sm"
            onClick={() => setSignInMode("phone")}
          >
            Sign in with phone number
          </Button>
          {!sellIntent ? (
            <AuthFooterLink
              prefix="Don't have an account?"
              linkText="Sign up"
              href={registerHref}
            />
          ) : null}
        </>
      )}
    </form>
  );
}
