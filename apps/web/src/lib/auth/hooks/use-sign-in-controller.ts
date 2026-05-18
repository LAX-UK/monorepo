"use client";

import { trackLogin } from "@/lib/analytics/events";
import { fetchSessionUserAfterAuth } from "@/lib/auth/fetch-session-user.client";
import { isSafeNextPath, resolvePostAuthDestination } from "@/lib/auth/post-auth-destination";
import { type SignInFormValues, signInFormSchema } from "@/lib/auth/schemas";
import { signInService } from "@/lib/auth/services/sign-in.service";
import { turnstileSiteKey } from "@/lib/auth/turnstile-site-key";
import { useAuthSubmit } from "@/lib/auth/use-auth-submit";
import { normalizeUserRoleOrClient } from "@auction/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";

export function useSignInController(nextHref: string) {
  const router = useRouter();
  const turnstileRef = useRef<string | undefined>(undefined);
  const { run, loading, bannerError, lastErrorCode } = useAuthSubmit((data: SignInFormValues) =>
    signInService({ ...data, turnstileToken: turnstileRef.current }),
  );
  const siteKey = turnstileSiteKey();
  const [showCaptcha, setShowCaptcha] = useState(false);

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
      const me = await fetchSessionUserAfterAuth();
      if (me) {
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
      } else {
        const base = isSafeNextPath(nextHref) ? nextHref : "/dashboard";
        const joiner = base.includes("?") ? "&" : "?";
        router.push(`${base}${joiner}welcome=back`);
      }
      router.refresh();
      return;
    }
    const maybeUnverified = result.code === "email_not_verified";
    if (maybeUnverified) {
      const q = isSafeNextPath(nextHref) ? `?next=${encodeURIComponent(nextHref)}` : "";
      router.push(`/register/verify-pending${q}`);
      router.refresh();
    }
  });

  return {
    form,
    onSubmit,
    loading,
    bannerError,
    lastErrorCode,
    showCaptcha: showCaptcha && Boolean(siteKey),
    turnstileSiteKey: siteKey,
    onTurnstileToken,
    onTurnstileExpire,
  };
}
