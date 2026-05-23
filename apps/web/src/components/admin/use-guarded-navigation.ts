"use client";

import { confirmGuardedNavigation } from "@/components/admin/dirty-navigation-registry";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Wraps `next/navigation` `router.push` / `router.replace` so they consult
 * the dirty-form registry before navigating. Use this from form Cancel
 * buttons instead of calling `router.push` directly so a `FormDirtyGuard`
 * higher in the tree gets a chance to ask the user.
 */
export function useGuardedNavigation() {
  const router = useRouter();

  const guardedPush = useCallback(
    (href: string) => {
      void (async () => {
        if (!(await confirmGuardedNavigation())) return;
        router.push(href);
      })();
    },
    [router],
  );

  const guardedReplace = useCallback(
    (href: string) => {
      void (async () => {
        if (!(await confirmGuardedNavigation())) return;
        router.replace(href);
      })();
    },
    [router],
  );

  return { guardedPush, guardedReplace };
}
