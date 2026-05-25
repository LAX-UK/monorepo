"use client";

import { disableTwoFactorService } from "@/lib/auth/services/disable-two-factor.service";
import { useRefetchAppSession } from "@/lib/auth/use-refetch-app-session";
import { notify } from "@/lib/ui/notify";
import { disableTwoFactorFormSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

export function useDisableTwoFactorController(onSuccess?: () => void) {
  const refetchSession = useRefetchAppSession();
  const [busy, setBusy] = useState(false);
  const form = useForm({
    resolver: zodResolver(disableTwoFactorFormSchema),
    defaultValues: { password: "" },
  });

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors("root");
    setBusy(true);
    const r = await disableTwoFactorService(values.password);
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
    form.reset();
    onSuccess?.();
  });

  return { busy, form, submit };
}
