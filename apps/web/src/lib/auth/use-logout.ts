"use client";

import { authClient } from "@/lib/auth-client";
import { useRefetchAppSession } from "@/lib/auth/use-refetch-app-session";
import { notify } from "@/lib/ui/notify";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export type UseLogoutOptions = {
  /** e.g. close mobile drawer before navigating */
  onBeforeNavigate?: () => void;
  /** Post-sign-out navigation target (default `/`). */
  redirectTo?: string;
};

export function useLogout(options?: UseLogoutOptions) {
  const router = useRouter();
  const refetchSession = useRefetchAppSession();
  const { onBeforeNavigate, redirectTo = "/" } = options ?? {};
  const [pending, setPending] = useState(false);

  const logout = useCallback(async () => {
    onBeforeNavigate?.();
    setPending(true);
    try {
      const { error } = await authClient.signOut();
      if (error) {
        notify.error(error.message ?? "Could not sign out");
        return;
      }
      await refetchSession();
      router.push(redirectTo);
      router.refresh();
    } catch {
      notify.error("Could not sign out");
    } finally {
      setPending(false);
    }
  }, [onBeforeNavigate, redirectTo, refetchSession, router]);

  return { logout, pending };
}
