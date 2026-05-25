"use client";

import { postAuthBroadcast } from "@/lib/auth/auth-broadcast";
import { fetchSessionUserAfterAuth } from "@/lib/auth/fetch-session-user.client";
import { isSafeNextPath, resolvePostAuthDestination } from "@/lib/auth/post-auth-destination";
import { verifyBackupCodeService } from "@/lib/auth/services/verify-backup-code.service";
import { verifyTotpService } from "@/lib/auth/services/verify-totp.service";
import { useRefetchAppSession } from "@/lib/auth/use-refetch-app-session";
import { notify } from "@/lib/ui/notify";
import { normalizeUserRoleOrClient } from "@auction/types";
import { backupCodeFormSchema, totpVerifyFormSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";

export type TwoFactorVerifyMode = "totp" | "backup";

export function useVerifyTotpController(nextHref: string) {
  const router = useRouter();
  const refetchSession = useRefetchAppSession();
  const [mode, setMode] = useState<TwoFactorVerifyMode>("totp");
  const [trustDevice, setTrustDevice] = useState(false);
  const [busy, setBusy] = useState(false);

  const totpForm = useForm({
    resolver: zodResolver(totpVerifyFormSchema),
    defaultValues: { code: "" },
  });

  const backupForm = useForm({
    resolver: zodResolver(backupCodeFormSchema),
    defaultValues: { code: "" },
  });

  const completeSignIn = useCallback(async () => {
    await refetchSession();
    postAuthBroadcast({ type: "signed-in" });
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
  }, [nextHref, refetchSession, router]);

  const submitTotp = useCallback(
    async (code: string) => {
      setBusy(true);
      const r = await verifyTotpService({
        code,
        ...(trustDevice ? { trustDevice: true } : {}),
      });
      setBusy(false);
      if (!r.ok) {
        notify.error(r.message);
        return false;
      }
      await completeSignIn();
      return true;
    },
    [completeSignIn, trustDevice],
  );

  const submitBackup = useCallback(
    async (code: string) => {
      setBusy(true);
      const r = await verifyBackupCodeService({
        code,
        ...(trustDevice ? { trustDevice: true } : {}),
      });
      setBusy(false);
      if (!r.ok) {
        notify.error(r.message);
        return false;
      }
      await completeSignIn();
      return true;
    },
    [completeSignIn, trustDevice],
  );

  return {
    mode,
    setMode,
    trustDevice,
    setTrustDevice,
    busy,
    totpForm,
    backupForm,
    submitTotp,
    submitBackup,
  };
}
