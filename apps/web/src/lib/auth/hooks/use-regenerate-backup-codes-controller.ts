"use client";

import { useConnectedAccounts } from "@/lib/auth/hooks/use-connected-accounts";
import { regenerateBackupCodesService } from "@/lib/auth/services/regenerate-backup-codes.service";
import { useRefetchAppSession } from "@/lib/auth/use-refetch-app-session";
import { notify } from "@/lib/ui/notify";
import { regenerateBackupCodesFormSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const optionalPasswordSchema = z.object({ password: z.string() });

export function useRegenerateBackupCodesController(onNewCodes: (codes: string[]) => void) {
  const refetchSession = useRefetchAppSession();
  const { state, loading: accountsLoading } = useConnectedAccounts();
  const hasPassword = state.hasPassword;
  const [busy, setBusy] = useState(false);
  const form = useForm<{ password: string }>({
    resolver: zodResolver(hasPassword ? regenerateBackupCodesFormSchema : optionalPasswordSchema),
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
    const r = await regenerateBackupCodesService(password);
    setBusy(false);
    if (!r.ok) {
      form.setError("root", { message: r.message });
      notify.error(r.message);
      return;
    }
    await refetchSession();
    form.reset({ password: "" });
    onNewCodes(r.backupCodes);
    notify.success("New backup codes generated", {
      description: "Previous backup codes no longer work. Store the new list safely.",
    });
  });

  return { hasPassword, accountsLoading, busy, form, submit };
}
