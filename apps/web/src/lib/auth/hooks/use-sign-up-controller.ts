"use client";

import { trackSignUp } from "@/lib/analytics/events";
import { trackSellAuthHandoff } from "@/lib/analytics/sell-funnel";
import { useSignUpWizardStep } from "@/lib/auth/hooks/use-sign-up-wizard-step";
import { notifySignUpRegistrationError } from "@/lib/auth/notify-sign-up-error";
import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
/** After email/password registration we always send users to verify-pending (product copy). */
import { type SignUpFormValues, signUpFormSchema } from "@/lib/auth/schemas";
import { signUpService } from "@/lib/auth/services/sign-up.service";
import type { SignUpWizardStep } from "@/lib/auth/sign-up-types";
import { turnstileSiteKey } from "@/lib/auth/turnstile-site-key";
import { useAuthSubmit } from "@/lib/auth/use-auth-submit";
import { notify } from "@/lib/ui/notify";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useState } from "react";
import { useForm } from "react-hook-form";

export function useSignUpController(opts?: {
  inviteToken?: string;
  /** Pre-resolved invite email (field is locked in the UI). */
  defaultEmail?: string;
  next?: string;
  loginHref?: string;
  forgotPasswordHref?: string;
  phoneDefaultCountry?: string;
  sellIntent?: boolean;
  initialStep?: SignUpWizardStep;
}) {
  const router = useRouter();
  const { run, loading } = useAuthSubmit(signUpService);
  const siteKey = turnstileSiteKey();
  const needsTurnstile = Boolean(siteKey);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: opts?.defaultEmail ?? "",
      phone: {
        country: opts?.phoneDefaultCountry ?? "GB",
        number: "",
      },
      password: "",
      persona: "individual",
      acceptTerms: false,
    },
  });

  const { step, goToDetails, backToPersona } = useSignUpWizardStep(
    form,
    opts?.initialStep ?? "persona",
  );

  const onTurnstileToken = useCallback(
    (t: string) => {
      setTurnstileToken(t);
      form.clearErrors("root");
    },
    [form],
  );

  const onTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const submitRegistration = form.handleSubmit(async (data) => {
    if (needsTurnstile && !turnstileToken) {
      notify.error("Please complete the security check.", { id: "signup-captcha-required" });
      return;
    }
    const { turnstileToken: _ignoredTs, ...rest } = data;
    const base = {
      ...rest,
      ...(opts?.inviteToken ? { inviteToken: opts.inviteToken } : {}),
    };
    const result = await run(turnstileToken ? { ...base, turnstileToken } : base);
    if (result.ok) {
      trackSignUp();
      if (opts?.sellIntent) {
        trackSellAuthHandoff();
      }
      const params = new URLSearchParams({ persona: data.persona, email: data.email });
      const safe = opts?.next && isSafeNextPath(opts.next) ? opts.next : undefined;
      if (safe) params.set("next", safe);
      router.push(`/register/verify-pending?${params.toString()}`);
      router.refresh();
      return;
    }

    const authLinks =
      opts?.loginHref && opts?.forgotPasswordHref
        ? {
            loginHref: opts.loginHref,
            forgotPasswordHref: opts.forgotPasswordHref,
            onNavigate: (href: string) => router.push(href),
          }
        : undefined;
    notifySignUpRegistrationError(result.code, result.message, authLinks);
  });

  const onSubmit = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      if (step !== "details") {
        event?.preventDefault();
        void goToDetails();
        return;
      }
      void submitRegistration(event);
    },
    [step, goToDetails, submitRegistration],
  );

  return {
    form,
    onSubmit,
    loading,
    step,
    goToDetails,
    backToPersona,
    turnstileSiteKey: siteKey,
    turnstileReady: !needsTurnstile || Boolean(turnstileToken),
    onTurnstileToken,
    onTurnstileExpire,
  };
}
