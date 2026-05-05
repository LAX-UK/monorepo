"use client";

import { type ResetPasswordFormValues, resetPasswordFormSchema } from "@/lib/auth/schemas";
import { resetPasswordService } from "@/lib/auth/services/reset-password.service";
import { useAuthSubmit } from "@/lib/auth/use-auth-submit";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

export function useResetPasswordController(token: string) {
  const router = useRouter();
  const { run, loading, bannerError } = useAuthSubmit(
    resetPasswordService.submit.bind(resetPasswordService),
  );
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await run({ token, newPassword: values.newPassword });
    if (result.ok) {
      router.replace("/login?reset=1");
    }
  });

  return { form, onSubmit, loading, bannerError };
}
