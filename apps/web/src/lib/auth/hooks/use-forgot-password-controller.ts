"use client";

import { useResendCooldown } from "@/lib/auth/hooks/use-resend-cooldown";
import { type ForgotPasswordFormValues, forgotPasswordFormSchema } from "@/lib/auth/schemas";
import { forgotPasswordService } from "@/lib/auth/services/forgot-password.service";
import { useAuthSubmit } from "@/lib/auth/use-auth-submit";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";

export function useForgotPasswordController() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const { remaining: cooldown, start: startCooldown } = useResendCooldown(45);
  const { run, loading, bannerError } = useAuthSubmit(forgotPasswordService);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    const result = await run(data);
    if (result.ok) {
      setSubmittedEmail(data.email);
    }
  });

  const resend = useCallback(async () => {
    if (!submittedEmail || cooldown > 0 || loading) return;
    const result = await run({ email: submittedEmail });
    if (result.ok) startCooldown(45);
  }, [submittedEmail, cooldown, loading, run, startCooldown]);

  return { form, onSubmit, loading, bannerError, submittedEmail, resend, cooldown };
}
