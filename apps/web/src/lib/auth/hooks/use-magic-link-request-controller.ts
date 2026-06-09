"use client";

import { parseAuthEmailParam } from "@/lib/auth/auth-route-links";
import { useResendCooldown } from "@/lib/auth/hooks/use-resend-cooldown";
import { type ForgotPasswordFormValues, forgotPasswordFormSchema } from "@/lib/auth/schemas";
import { requestMagicLinkService } from "@/lib/auth/services/request-magic-link.service";
import { turnstileSiteKey } from "@/lib/auth/turnstile-site-key";
import { useAuthSubmit } from "@/lib/auth/use-auth-submit";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";

export function useMagicLinkRequestController() {
  const searchParams = useSearchParams();
  const prefillEmail = parseAuthEmailParam(searchParams.get("email"));
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const { remaining: cooldown, start: startCooldown } = useResendCooldown(45);
  const webOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const submitMagicLink = useCallback(
    (input: ForgotPasswordFormValues & { turnstileToken?: string }) =>
      requestMagicLinkService({
        email: input.email,
        ...(input.turnstileToken ? { turnstileToken: input.turnstileToken } : {}),
        webOrigin,
      }),
    [webOrigin],
  );
  const { run, loading, bannerError } = useAuthSubmit(submitMagicLink);
  const siteKey = turnstileSiteKey();
  const needsTurnstile = Boolean(siteKey);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: { email: prefillEmail ?? "" },
  });

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

  const onSubmit = form.handleSubmit(async (data) => {
    if (needsTurnstile && !turnstileToken) {
      form.setError("root", { message: "Please complete the security check." });
      return;
    }
    const result = await run({
      ...data,
      ...(turnstileToken ? { turnstileToken } : {}),
    });
    if (result.ok) {
      setSubmittedEmail(data.email);
    }
  });

  const resend = useCallback(async () => {
    if (!submittedEmail || cooldown > 0 || loading) return;
    if (needsTurnstile && !turnstileToken) return;
    const result = await run({
      email: submittedEmail,
      ...(turnstileToken ? { turnstileToken } : {}),
    });
    if (result.ok) startCooldown(45);
  }, [submittedEmail, cooldown, loading, run, startCooldown, needsTurnstile, turnstileToken]);

  return {
    form,
    onSubmit,
    loading,
    bannerError,
    submittedEmail,
    resend,
    cooldown,
    turnstileSiteKey: siteKey,
    onTurnstileToken,
    onTurnstileExpire,
    turnstileReady: !needsTurnstile || Boolean(turnstileToken),
  };
}
