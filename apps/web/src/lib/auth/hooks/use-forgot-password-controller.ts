"use client";

import { parseAuthEmailParam } from "@/lib/auth/auth-route-links";
import { useResendCooldown } from "@/lib/auth/hooks/use-resend-cooldown";
import { type ForgotPasswordFormValues, forgotPasswordFormSchema } from "@/lib/auth/schemas";
import { forgotPasswordService } from "@/lib/auth/services/forgot-password.service";
import { turnstileSiteKey } from "@/lib/auth/turnstile-site-key";
import { useAuthSubmit } from "@/lib/auth/use-auth-submit";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";

export function useForgotPasswordController() {
  const searchParams = useSearchParams();
  const prefillEmail = parseAuthEmailParam(searchParams.get("email"));
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const { remaining: cooldown, start: startCooldown } = useResendCooldown(45);
  const { run, loading, bannerError, lastErrorCode } = useAuthSubmit(forgotPasswordService);
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
    lastErrorCode,
    submittedEmail,
    resend,
    cooldown,
    turnstileSiteKey: siteKey,
    onTurnstileToken,
    onTurnstileExpire,
    turnstileReady: !needsTurnstile || Boolean(turnstileToken),
  };
}
