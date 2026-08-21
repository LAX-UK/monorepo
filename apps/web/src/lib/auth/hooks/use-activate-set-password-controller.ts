"use client";

import { useConnectedAccounts } from "@/lib/auth/hooks/use-connected-accounts";
import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { postLoginHandoffHref } from "@/lib/auth/post-login-handoff";
import { type ResetPasswordFormValues, resetPasswordFormSchema } from "@/lib/auth/schemas";
import { useAppSession } from "@/lib/auth/use-app-session";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

type UseActivateSetPasswordControllerOptions = {
  /** When true, the server already gated on password status, so don't block render on the client fetch. */
  serverConfirmedNoPassword?: boolean;
};

export function useActivateSetPasswordController(
  options: UseActivateSetPasswordControllerOptions = {},
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next");
  const safeNext = isSafeNextPath(requestedNext) ? requestedNext : undefined;
  const { user } = useAppSession();
  const { state, loading: accountsLoading, setupPassword } = useConnectedAccounts();
  const [loading, setLoading] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const navigatedRef = useRef(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const destination = postLoginHandoffHref(safeNext);

  const finish = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    router.replace(destination);
  }, [router, destination]);

  // Client fallback: server should redirect password users before this page renders.
  useEffect(() => {
    if (accountsLoading) return;
    if (state.hasPassword) {
      finish();
    }
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
    initializing: accountsLoading && !options.serverConfirmedNoPassword,
  };
}
