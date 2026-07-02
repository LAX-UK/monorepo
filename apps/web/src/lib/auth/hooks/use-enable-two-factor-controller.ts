"use client";

import { useConnectedAccounts } from "@/lib/auth/hooks/use-connected-accounts";
import { notifyTwoFactorEnabledEmail } from "@/lib/auth/security-notify.client";
import { enableTwoFactorService } from "@/lib/auth/services/enable-two-factor.service";
import { verifyTotpService } from "@/lib/auth/services/verify-totp.service";
import { useRefetchAppSession } from "@/lib/auth/use-refetch-app-session";
import { notify } from "@/lib/ui/notify";
import { enableTwoFactorFormSchema, totpVerifyFormSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

export type EnableWizardStep = "password" | "intro" | "qr" | "confirm" | "backup";

const optionalPasswordSchema = z.object({ password: z.string() });

function initialStepFor(hasPassword: boolean): EnableWizardStep {
  return hasPassword ? "password" : "intro";
}

function isInitialStep(step: EnableWizardStep): boolean {
  return step === "password" || step === "intro";
}

export function useEnableTwoFactorController() {
  const refetchSession = useRefetchAppSession();
  const {
    state,
    loading: accountsLoading,
    error: accountsError,
    refresh: refreshAccounts,
  } = useConnectedAccounts();
  const hasPassword = state.hasPassword;
  const accountsFirstLoadFailed =
    !accountsLoading && accountsError != null && state.accounts.length === 0;
  const [step, setStep] = useState<EnableWizardStep>("intro");
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const pwdForm = useForm<{ password: string }>({
    resolver: zodResolver(hasPassword ? enableTwoFactorFormSchema : optionalPasswordSchema),
    defaultValues: { password: "" },
  });

  const confirmForm = useForm({
    resolver: zodResolver(totpVerifyFormSchema),
    defaultValues: { code: "" },
  });

  // Re-align the initial step once account state is known. `useState` only runs
  // once, so without this effect password users would see the OAuth-only intro.
  useEffect(() => {
    if (accountsLoading || busy) return;
    setStep((current) => (isInitialStep(current) ? initialStepFor(hasPassword) : current));
  }, [accountsLoading, busy, hasPassword]);

  const beginEnable = useCallback(
    async (password?: string) => {
      pwdForm.clearErrors("root");
      setBusy(true);
      const r = await enableTwoFactorService(password);
      setBusy(false);
      if (!r.ok) {
        pwdForm.setError("root", { message: r.message });
        notify.error(r.message);
        return false;
      }
      setTotpURI(r.totpURI);
      setBackupCodes(r.backupCodes);
      setStep("qr");
      return true;
    },
    [pwdForm],
  );

  const startEnable = pwdForm.handleSubmit(async (values) => {
    if (accountsLoading) return;
    if (hasPassword && values.password.length === 0) {
      pwdForm.setError("password", { message: "Password is required" });
      return;
    }
    const password = values.password.length > 0 ? values.password : undefined;
    await beginEnable(password);
  });

  const startPasswordlessEnable = useCallback(async () => {
    if (accountsLoading) return;
    await beginEnable();
  }, [accountsLoading, beginEnable]);

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
    setStep(initialStepFor(hasPassword));
    setTotpURI(null);
    setBackupCodes([]);
    pwdForm.reset({ password: "" });
    confirmForm.reset();
  }, [hasPassword, pwdForm, confirmForm]);

  return {
    hasPassword,
    accountsLoading,
    accountsError,
    accountsFirstLoadFailed,
    refreshAccounts,
    step,
    setStep,
    totpURI,
    backupCodes,
    busy,
    pwdForm,
    confirmForm,
    startEnable,
    startPasswordlessEnable,
    verifyEnable,
    goToConfirm,
    resetWizard,
  };
}
