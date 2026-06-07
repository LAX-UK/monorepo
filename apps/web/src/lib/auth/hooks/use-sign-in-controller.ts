"use client";

import { trackLogin } from "@/lib/analytics/events";
import { trackSellAuthHandoff } from "@/lib/analytics/sell-funnel";
import { postAuthBroadcast } from "@/lib/auth/auth-broadcast";
import {
  POST_AUTH_SESSION_LOAD_ERROR,
  fetchSessionUserWithRetry,
} from "@/lib/auth/fetch-session-user-with-retry.client";
import { isSafeNextPath, resolvePostAuthDestination } from "@/lib/auth/post-auth-destination";
import { type SignInFormValues, signInFormSchema } from "@/lib/auth/schemas";
import { signInService } from "@/lib/auth/services/sign-in.service";
import { turnstileSiteKey } from "@/lib/auth/turnstile-site-key";
import { useAuthSubmit } from "@/lib/auth/use-auth-submit";
import { useRefetchAppSession } from "@/lib/auth/use-refetch-app-session";
import { notify } from "@/lib/ui/notify";
import { normalizeUserRoleOrClient } from "@auction/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";

type SignInControllerOptions = {
  sellIntent?: boolean;
};

export function useSignInController(nextHref: string, options: SignInControllerOptions = {}) {
  const router = useRouter();
  const refetchSession = useRefetchAppSession();
  const turnstileRef = useRef<string | undefined>(undefined);
  const { run, loading, bannerError, lastErrorCode } = useAuthSubmit((data: SignInFormValues) =>
    signInService({ ...data, turnstileToken: turnstileRef.current }),
  );
  const siteKey = turnstileSiteKey();
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [postAuthError, setPostAuthError] = useState<string | null>(null);

  const onTurnstileToken = useCallback((t: string) => {
    turnstileRef.current = t;
  }, []);

  const onTurnstileExpire = useCallback(() => {
    turnstileRef.current = undefined;
  }, []);

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    const result = await run(data);
    if (!result.ok && result.code === "captcha_required" && siteKey) {
      setShowCaptcha(true);
      return;
    }
    if (result.ok) {
      setShowCaptcha(false);
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
    bannerError: bannerError ?? postAuthError,
    lastErrorCode,
    showCaptcha: showCaptcha && Boolean(siteKey),
    turnstileSiteKey: siteKey,
    onTurnstileToken,
    onTurnstileExpire,
  };
}
