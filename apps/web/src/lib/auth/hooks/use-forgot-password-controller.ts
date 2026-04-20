"use client";

import { type ForgotPasswordFormValues, forgotPasswordFormSchema } from "@/lib/auth/schemas";
import { forgotPasswordService } from "@/lib/auth/services/forgot-password.service";
import { useAuthSubmit } from "@/lib/auth/use-auth-submit";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

export function useForgotPasswordController() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
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

  return { form, onSubmit, loading, bannerError, submittedEmail };
}
