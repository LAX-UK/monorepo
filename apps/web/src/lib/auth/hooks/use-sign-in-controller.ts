"use client";

import { type SignInFormValues, signInFormSchema } from "@/lib/auth/schemas";
import { signInService } from "@/lib/auth/services/sign-in.service";
import { useAuthSubmit } from "@/lib/auth/use-auth-submit";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

export function useSignInController(nextHref: string) {
  const router = useRouter();
  const { run, loading, bannerError } = useAuthSubmit(signInService);

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    const result = await run(data);
    if (result.ok) {
      router.push(nextHref.startsWith("/") ? nextHref : "/dashboard");
      router.refresh();
      return;
    }
    const maybeUnverified =
      result.code === "EMAIL_NOT_VERIFIED" || /email.*not.*verified/i.test(result.message);
    if (maybeUnverified) {
      router.push(`/register/verify-pending?email=${encodeURIComponent(data.email)}`);
      router.refresh();
    }
  });

  return { form, onSubmit, loading, bannerError };
}
