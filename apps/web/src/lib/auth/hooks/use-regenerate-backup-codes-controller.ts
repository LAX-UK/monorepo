"use client";

import { authClient } from "@/lib/auth-client";
import { regenerateBackupCodesService } from "@/lib/auth/services/regenerate-backup-codes.service";
import { notify } from "@/lib/ui/notify";
import { regenerateBackupCodesFormSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

export function useRegenerateBackupCodesController(onNewCodes: (codes: string[]) => void) {
  const session = authClient.useSession();
  const [busy, setBusy] = useState(false);
  const form = useForm({
    resolver: zodResolver(regenerateBackupCodesFormSchema),
    defaultValues: { password: "" },
  });

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors("root");
    setBusy(true);
    const r = await regenerateBackupCodesService(values.password);
    setBusy(false);
    if (!r.ok) {
      form.setError("root", { message: r.message });
      notify.error(r.message);
      return;
    }
    await session.refetch({ query: { disableCookieCache: true } });
    form.reset();
    onNewCodes(r.backupCodes);
    notify.success("New backup codes generated", {
      description: "Previous backup codes no longer work. Store the new list safely.",
    });
  });

  return { busy, form, submit };
}
