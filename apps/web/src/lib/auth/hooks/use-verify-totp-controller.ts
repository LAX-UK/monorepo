"use client";

import { trackLogin } from "@/lib/analytics/events";
import { postAuthBroadcast } from "@/lib/auth/auth-broadcast";
import { fetchSessionUserAfterAuth } from "@/lib/auth/fetch-session-user.client";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth-destination";
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
      router.push(
        resolvePostAuthDestination({
          user: {
            email: "",
            role: "client",
            emailVerified: true,
            suspended: false,
          },
          requestedNext: nextHref,
          context: "sign-in",
          requireEmailVerification: false,
          withWelcomeBack: true,
        }),
      );
    }
    router.refresh();
  }, [nextHref, refetchSession, router]);

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
