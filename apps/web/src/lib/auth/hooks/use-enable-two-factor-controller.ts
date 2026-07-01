"use client";

import { notifyTwoFactorEnabledEmail } from "@/lib/auth/security-notify.client";
import { enableTwoFactorService } from "@/lib/auth/services/enable-two-factor.service";
import { verifyTotpService } from "@/lib/auth/services/verify-totp.service";
import { useRefetchAppSession } from "@/lib/auth/use-refetch-app-session";
import { notify } from "@/lib/ui/notify";
import { enableTwoFactorFormSchema, totpVerifyFormSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";

export type EnableWizardStep = "password" | "qr" | "confirm" | "backup";

export function useEnableTwoFactorController() {
  const refetchSession = useRefetchAppSession();
  const [step, setStep] = useState<EnableWizardStep>("password");
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const pwdForm = useForm({
    resolver: zodResolver(enableTwoFactorFormSchema),
    defaultValues: { password: "" },
  });

  const confirmForm = useForm({
    resolver: zodResolver(totpVerifyFormSchema),
    defaultValues: { code: "" },
  });

  const startEnable = pwdForm.handleSubmit(async (values) => {
    pwdForm.clearErrors("root");
    setBusy(true);
    const r = await enableTwoFactorService(values.password);
    setBusy(false);
    if (!r.ok) {
      pwdForm.setError("root", { message: r.message });
      notify.error(r.message);
      return;
    }
    setTotpURI(r.totpURI);
    setBackupCodes(r.backupCodes);
    setStep("qr");
  });

  const verifyEnable = confirmForm.handleSubmit(async (values) => {
    confirmForm.clearErrors("root");
    setBusy(true);
    const r = await verifyTotpService({ code: values.code });
    setBusy(false);
    if (!r.ok) {
      confirmForm.setError("code", { message: r.message });
      notify.error(r.message);
      return;
    }
    // 2FA is actually turned on now — this is the right point to notify the user.
    notifyTwoFactorEnabledEmail();
    await refetchSession();
    setStep("backup");
  });

  const goToConfirm = useCallback(() => {
    setStep("confirm");
  }, []);

  const resetWizard = useCallback(() => {
    setStep("password");
    setTotpURI(null);
    setBackupCodes([]);
    pwdForm.reset();
    confirmForm.reset();
  }, [pwdForm, confirmForm]);

  return {
    step,
    setStep,
    totpURI,
    backupCodes,
    busy,
    pwdForm,
    confirmForm,
    startEnable,
    verifyEnable,
    goToConfirm,
    resetWizard,
  };
}
