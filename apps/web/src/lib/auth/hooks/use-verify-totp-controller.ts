"use client";

import { trackLogin } from "@/lib/analytics/events";
import { postAuthBroadcast } from "@/lib/auth/auth-broadcast";
import { beginBidOidcLogin } from "@/lib/auth/begin-bid-oidc-login.client";
import { verifyBackupCodeService } from "@/lib/auth/services/verify-backup-code.service";
import { verifyTotpService } from "@/lib/auth/services/verify-totp.service";
import { notify } from "@/lib/ui/notify";
import { backupCodeFormSchema, totpVerifyFormSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";

export type TwoFactorVerifyMode = "totp" | "backup";

export function useVerifyTotpController(nextHref: string) {
  const [mode, setMode] = useState<TwoFactorVerifyMode>("totp");
  const [trustDevice, setTrustDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const totpForm = useForm({
    resolver: zodResolver(totpVerifyFormSchema),
    defaultValues: { code: "" },
  });

  const backupForm = useForm({
    resolver: zodResolver(backupCodeFormSchema),
    defaultValues: { code: "" },
  });

  const completeSignIn = useCallback(async () => {
    postAuthBroadcast({ type: "signed-in" });
    beginBidOidcLogin(nextHref);
  }, [nextHref]);

  const submitTotp = useCallback(
    async (code: string) => {
      setBusy(true);
      setBannerError(null);
      try {
        const r = await verifyTotpService({
          code,
          ...(trustDevice ? { trustDevice: true } : {}),
        });
        if (!r.ok) {
          setBannerError(r.message);
          notify.error(r.message);
          return false;
        }
        trackLogin();
        await completeSignIn();
        return true;
      } catch {
        const message = "Network error. Try again.";
        setBannerError(message);
        notify.error(message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [completeSignIn, trustDevice],
  );

  const submitBackup = useCallback(
    async (code: string) => {
      setBusy(true);
      setBannerError(null);
      try {
        const r = await verifyBackupCodeService({
          code,
          ...(trustDevice ? { trustDevice: true } : {}),
        });
        if (!r.ok) {
          setBannerError(r.message);
          notify.error(r.message);
          return false;
        }
        trackLogin();
        await completeSignIn();
        return true;
      } catch {
        const message = "Network error. Try again.";
        setBannerError(message);
        notify.error(message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [completeSignIn, trustDevice],
  );

  return {
    mode,
    setMode,
    trustDevice,
    setTrustDevice,
    busy,
    bannerError,
    totpForm,
    backupForm,
    submitTotp,
    submitBackup,
  };
}
