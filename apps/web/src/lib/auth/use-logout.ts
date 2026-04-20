"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

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
        toast.error(error.message ?? "Could not sign out");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Could not sign out");
    } finally {
      setPending(false);
    }
  }, [onBeforeNavigate, router]);

  return { logout, pending };
}
