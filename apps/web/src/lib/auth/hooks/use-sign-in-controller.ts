"use client";

import { fetchSessionUserAfterAuth } from "@/lib/auth/fetch-session-user.client";
import { isSafeNextPath, resolvePostAuthDestination } from "@/lib/auth/post-auth-destination";
import { type SignInFormValues, signInFormSchema } from "@/lib/auth/schemas";
import { signInService } from "@/lib/auth/services/sign-in.service";
import { useAuthSubmit } from "@/lib/auth/use-auth-submit";
import { normalizeUserRoleOrClient } from "@auction/types";
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
    const maybeUnverified =
      result.code === "EMAIL_NOT_VERIFIED" || /email.*not.*verified/i.test(result.message);
    if (maybeUnverified) {
      router.push(`/register/verify-pending?email=${encodeURIComponent(data.email)}`);
      router.refresh();
    }
  });

  return { form, onSubmit, loading, bannerError };
}
