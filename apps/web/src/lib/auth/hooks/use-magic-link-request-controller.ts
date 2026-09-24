"use client";

import { parseAuthEmailParam } from "@/lib/auth/auth-route-links";
import { useResendCooldown } from "@/lib/auth/hooks/use-resend-cooldown";
import { useTurnstileField } from "@/lib/auth/hooks/use-turnstile-field";
import { type ForgotPasswordFormValues, forgotPasswordFormSchema } from "@/lib/auth/schemas";
import { requestMagicLinkService } from "@/lib/auth/services/request-magic-link.service";
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
  const {
    turnstileSiteKey,
    needsTurnstile,
    turnstileToken,
    turnstileReady,
    turnstileLoadError,
    onTurnstileReady,
    onTurnstileToken,
    onTurnstileExpire,
    onTurnstileError,
    resetTurnstileAfterFailedSubmit,
  } = useTurnstileField();

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: { email: prefillEmail ?? "" },
  });

  const onTurnstileTokenWithClear = useCallback(
    (t: string) => {
      onTurnstileToken(t);
      form.clearErrors("root");
    },
    [form, onTurnstileToken],
  );

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
      return;
    }
    resetTurnstileAfterFailedSubmit(result.code);
  });

  const resend = useCallback(async () => {
    if (!submittedEmail || cooldown > 0 || loading) return;
    if (needsTurnstile && !turnstileToken) return;
    const result = await run({
      email: submittedEmail,
      ...(turnstileToken ? { turnstileToken } : {}),
    });
    if (result.ok) {
      startCooldown(45);
      return;
    }
    resetTurnstileAfterFailedSubmit(result.code);
  }, [
    submittedEmail,
    cooldown,
    loading,
    run,
    startCooldown,
    needsTurnstile,
    turnstileToken,
    resetTurnstileAfterFailedSubmit,
  ]);

  return {
    form,
    onSubmit,
    loading,
    bannerError,
    submittedEmail,
    resend,
    cooldown,
    turnstileSiteKey,
    onTurnstileReady,
    onTurnstileToken: onTurnstileTokenWithClear,
    onTurnstileExpire,
    onTurnstileError,
    turnstileReady,
    turnstileLoadError,
  };
}
