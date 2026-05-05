"use client";

import { authClient } from "@/lib/auth-client";
import { notify } from "@/lib/ui/notify";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export type UseLogoutOptions = {
  /** e.g. close mobile drawer before navigating */
  onBeforeNavigate?: () => void;
};

export function useLogout(options?: UseLogoutOptions) {
  const router = useRouter();
  const { onBeforeNavigate } = options ?? {};
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
      router.push("/");
      router.refresh();
    } catch {
      notify.error("Could not sign out");
    } finally {
      setPending(false);
    }
  }, [onBeforeNavigate, router]);

  return { logout, pending };
}
