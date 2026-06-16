"use client";

import { trackLogin } from "@/lib/analytics/events";
import { trackSellAuthHandoff } from "@/lib/analytics/sell-funnel";
import { postAuthBroadcast } from "@/lib/auth/auth-broadcast";
import { isEmailFirstLoginEnabled } from "@/lib/auth/email-first-login";
import {
  POST_AUTH_SESSION_LOAD_ERROR,
  fetchSessionUserWithRetry,
} from "@/lib/auth/fetch-session-user-with-retry.client";
import { useResendCooldown } from "@/lib/auth/hooks/use-resend-cooldown";
import { isSafeNextPath, resolvePostAuthDestination } from "@/lib/auth/post-auth-destination";
import { type SignInFormValues, signInFormSchema } from "@/lib/auth/schemas";
import { requestMagicLinkService } from "@/lib/auth/services/request-magic-link.service";
import { signInService } from "@/lib/auth/services/sign-in.service";
import { turnstileSiteKey } from "@/lib/auth/turnstile-site-key";
import { useAuthSubmit } from "@/lib/auth/use-auth-submit";
import { useRefetchAppSession } from "@/lib/auth/use-refetch-app-session";
import { clearClientActingLegalEntityId } from "@/lib/legal-entity/client-acting-context";
import { notify } from "@/lib/ui/notify";
import { normalizeUserRoleOrClient } from "@auction/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";

export type SignInStep = "email" | "credentials";

type SignInControllerOptions = {
  sellIntent?: boolean;
  prefillEmail?: string;
  /** When true, Step 1 collects email before password / magic-link options. */
  emailFirst?: boolean;
  initialStep?: SignInStep;
};

export function useSignInController(nextHref: string, options: SignInControllerOptions = {}) {
  const router = useRouter();
  const refetchSession = useRefetchAppSession();
  const emailFirst = options.emailFirst ?? isEmailFirstLoginEnabled();
  const turnstileRef = useRef<string | undefined>(undefined);
  const [magicLinkTurnstileToken, setMagicLinkTurnstileToken] = useState<string | null>(null);
  const { run, loading, bannerError, lastErrorCode } = useAuthSubmit((data: SignInFormValues) =>
    signInService({ ...data, turnstileToken: turnstileRef.current }),
  );
  const siteKey = turnstileSiteKey();
  const needsMagicLinkTurnstile = Boolean(siteKey);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [signInCaptchaToken, setSignInCaptchaToken] = useState<string | null>(null);
  const [captchaGateError, setCaptchaGateError] = useState<string | null>(null);
  const [postAuthError, setPostAuthError] = useState<string | null>(null);
  const [step, setStep] = useState<SignInStep>(
    emailFirst ? (options.initialStep ?? "email") : "credentials",
  );
  const [linkSent, setLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkError, setMagicLinkError] = useState<string | null>(null);
  const { remaining: linkCooldown, start: startLinkCooldown } = useResendCooldown(45);
  const webOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const signInTurnstileReady = !showCaptcha || !siteKey || Boolean(signInCaptchaToken);
  const signInSubmitDisabled = loading || !signInTurnstileReady;

  const onTurnstileToken = useCallback((t: string) => {
    turnstileRef.current = t;
    setSignInCaptchaToken(t);
    setCaptchaGateError(null);
  }, []);

  const onTurnstileExpire = useCallback(() => {
    turnstileRef.current = undefined;
    setSignInCaptchaToken(null);
  }, []);

  const onMagicLinkTurnstileToken = useCallback((t: string) => {
    setMagicLinkTurnstileToken(t);
    setMagicLinkError(null);
  }, []);

  const onMagicLinkTurnstileExpire = useCallback(() => {
    setMagicLinkTurnstileToken(null);
  }, []);

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: {
      email: options.prefillEmail ?? "",
      password: "",
    },
  });

  const goToCredentials = useCallback(() => {
    const email = form.getValues("email").trim();
    const parsed = signInFormSchema.shape.email.safeParse(email);
    if (!parsed.success) {
      form.setError("email", { message: "Enter a valid email address" });
      return;
    }
    form.clearErrors("email");
    setLinkSent(false);
    setMagicLinkError(null);
    setStep("credentials");
  }, [form]);

  const changeEmail = useCallback(() => {
    setLinkSent(false);
    setMagicLinkError(null);
    setStep("email");
  }, []);

  const requestMagicLink = useCallback(async () => {
    const email = form.getValues("email").trim();
    const parsed = signInFormSchema.shape.email.safeParse(email);
    if (!parsed.success) {
      form.setError("email", { message: "Enter a valid email address" });
      return;
    }
    if (needsMagicLinkTurnstile && !magicLinkTurnstileToken) {
      setMagicLinkError("Please complete the security check.");
      return;
    }
    setMagicLinkLoading(true);
    setMagicLinkError(null);
    const safeNext = isSafeNextPath(nextHref) ? nextHref : undefined;
    const result = await requestMagicLinkService({
      email,
      webOrigin,
      ...(safeNext ? { next: safeNext } : {}),
      ...(magicLinkTurnstileToken ? { turnstileToken: magicLinkTurnstileToken } : {}),
    });
    setMagicLinkLoading(false);
    if (!result.ok) {
      setMagicLinkError(
        result.code === "rate_limited"
          ? "Too many requests. Please wait and try again."
          : result.code === "captcha_required" || result.code === "captcha_invalid"
            ? "Please complete the security check and try again."
            : "We could not send a sign-in link. Please try again.",
      );
      return;
    }
    setLinkSent(true);
    startLinkCooldown(45);
  }, [
    form,
    needsMagicLinkTurnstile,
    magicLinkTurnstileToken,
    nextHref,
    webOrigin,
    startLinkCooldown,
  ]);

  const resendMagicLink = useCallback(async () => {
    if (linkCooldown > 0 || magicLinkLoading || !linkSent) return;
    await requestMagicLink();
  }, [linkCooldown, magicLinkLoading, linkSent, requestMagicLink]);

  const onSubmit = form.handleSubmit(async (data) => {
    if (showCaptcha && siteKey && !turnstileRef.current) {
      setCaptchaGateError("Please complete the security check.");
      return;
    }
    setCaptchaGateError(null);
    const result = await run(data);
    if (!result.ok && result.code === "captcha_required" && siteKey) {
      setShowCaptcha(true);
      setSignInCaptchaToken(null);
      turnstileRef.current = undefined;
      return;
    }
    if (result.ok) {
      setShowCaptcha(false);
      setSignInCaptchaToken(null);
      turnstileRef.current = undefined;
      if (result.requiresTwoFactor) {
        const safeNext = isSafeNextPath(nextHref) ? nextHref : "/dashboard";
        router.push(`/login/two-factor?next=${encodeURIComponent(safeNext)}`);
        router.refresh();
        return;
      }
      trackLogin();
      if (options.sellIntent) {
        trackSellAuthHandoff();
      }
      await refetchSession();
      // Reset acting context to the personal entity on every fresh sign-in so a
      // stale `lax_acting_legal_entity_id` cookie from a previous account/org
      // cannot leak into API calls (e.g. bids -> not_a_member_of_legal_entity).
      clearClientActingLegalEntityId();
      postAuthBroadcast({ type: "signed-in" });
      setPostAuthError(null);
      const me = await fetchSessionUserWithRetry();
      if (!me) {
        setPostAuthError(POST_AUTH_SESSION_LOAD_ERROR);
        notify.error(POST_AUTH_SESSION_LOAD_ERROR);
        return;
      }
      router.push(
        resolvePostAuthDestination({
          user: {
            ...me,
            role: normalizeUserRoleOrClient(me.role),
          },
          requestedNext: nextHref,
          context: "sign-in",
          requireEmailVerification: false,
          withWelcomeBack: true,
        }),
      );
      router.refresh();
      return;
    }
    const maybeUnverified = result.code === "email_not_verified";
    if (maybeUnverified) {
      const params = new URLSearchParams({ email: data.email });
      if (isSafeNextPath(nextHref)) params.set("next", nextHref);
      const qs = params.toString();
      router.push(`/register/verify-pending?${qs}`);
      router.refresh();
    }
  });

  return {
    form,
    onSubmit,
    loading,
    bannerError: captchaGateError ?? bannerError ?? postAuthError,
    lastErrorCode,
    showCaptcha: showCaptcha && Boolean(siteKey),
    turnstileSiteKey: siteKey ?? null,
    onTurnstileToken,
    onTurnstileExpire,
    signInSubmitDisabled,
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
    magicLinkTurnstileReady: !needsMagicLinkTurnstile || Boolean(magicLinkTurnstileToken),
    onMagicLinkTurnstileToken,
    onMagicLinkTurnstileExpire,
  };
}
