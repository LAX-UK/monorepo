"use client";

import { type SignUpFormValues, signUpFormSchema } from "@/lib/auth/schemas";
import { signUpService } from "@/lib/auth/services/sign-up.service";
import { useAuthSubmit } from "@/lib/auth/use-auth-submit";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

export function useSignUpController(opts?: { inviteToken?: string }) {
  const router = useRouter();
  const { run, loading, bannerError } = useAuthSubmit(signUpService);

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      mobile: "",
      password: "",
      acceptTerms: false,
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    const payload = {
      ...data,
      ...(opts?.inviteToken ? { inviteToken: opts.inviteToken } : {}),
    };
    const result = await run(payload);
    if (result.ok) {
      router.push("/login?registered=1&next=/dashboard");
      router.refresh();
    }
  });

  return { form, onSubmit, loading, bannerError };
}
