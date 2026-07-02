"use client";

import { useConnectedAccounts } from "@/lib/auth/hooks/use-connected-accounts";
import { disableTwoFactorService } from "@/lib/auth/services/disable-two-factor.service";
import { useRefetchAppSession } from "@/lib/auth/use-refetch-app-session";
import { notify } from "@/lib/ui/notify";
import { disableTwoFactorFormSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const optionalPasswordSchema = z.object({ password: z.string() });

export function useDisableTwoFactorController(onSuccess?: () => void) {
  const refetchSession = useRefetchAppSession();
  const { state, loading: accountsLoading } = useConnectedAccounts();
  const hasPassword = state.hasPassword;
  const [busy, setBusy] = useState(false);
  const form = useForm<{ password: string }>({
    resolver: zodResolver(hasPassword ? disableTwoFactorFormSchema : optionalPasswordSchema),
    defaultValues: { password: "" },
  });

  const submit = form.handleSubmit(async (values) => {
    if (accountsLoading) return;
    form.clearErrors("root");
    setBusy(true);
    const password = values.password.length > 0 ? values.password : undefined;
    if (hasPassword && !password) {
      form.setError("password", { message: "Password is required" });
      setBusy(false);
      return;
    }
    const r = await disableTwoFactorService(password);
    setBusy(false);
    if (!r.ok) {
      form.setError("root", { message: r.message });
      notify.error(r.message);
      return;
    }
    await refetchSession();
    notify.success("Two-factor authentication turned off", {
      description: "You can turn it back on any time from Security settings.",
    });
    form.reset({ password: "" });
    onSuccess?.();
  });

  return { hasPassword, accountsLoading, busy, form, submit };
}
