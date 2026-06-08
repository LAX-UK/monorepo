"use client";

import { useConnectedAccounts } from "@/lib/auth/hooks/use-connected-accounts";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth-destination";
import { type ResetPasswordFormValues, resetPasswordFormSchema } from "@/lib/auth/schemas";
import { useAppSession } from "@/lib/auth/use-app-session";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

export function useActivateSetPasswordController() {
  const router = useRouter();
  const { user } = useAppSession();
  const { state, loading: accountsLoading, setupPassword } = useConnectedAccounts();
  const [loading, setLoading] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const navigatedRef = useRef(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const destination =
    user != null
      ? resolvePostAuthDestination({
          user,
          context: "sign-in",
          requireEmailVerification: false,
        })
      : "/dashboard";

  const finish = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    router.replace(destination);
  }, [router, destination]);

  // Users who already have a password (e.g. re-using an activation link) should not
  // be asked to set one again — send them straight into the auction once we know.
  useEffect(() => {
    if (!accountsLoading && state.hasPassword) finish();
  }, [accountsLoading, state.hasPassword, finish]);

  const onSkip = useCallback(() => {
    finish();
  }, [finish]);

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    setBannerError(null);
    const result = await setupPassword(values.newPassword);
    if (result.ok) {
      finish();
      return;
    }
    if (result.error.includes("already set") || result.error.includes("credential_already_set")) {
      finish();
      return;
    }
    setLoading(false);
    setBannerError(result.error);
  });

  return {
    form,
    onSubmit,
    onSkip,
    loading,
    bannerError,
    userEmail: user?.email ?? null,
    /** True while we determine whether the user already has a password. */
    initializing: accountsLoading,
  };
}
