"use client";

import { confirmDiscardChanges } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * `router.push` and `router.replace` that ask first when a form on the page has unsaved
 * changes. Use from Cancel buttons instead of the router directly, so a `FormDirtyGuard`
 * higher in the tree gets a chance to ask.
 */
export function useGuardedNavigation() {
  const router = useRouter();

  const guardedPush = useCallback(
    (href: string) => {
      void confirmDiscardChanges().then((discard) => {
        if (discard) router.push(href);
      });
    },
    [router],
  );

  const guardedReplace = useCallback(
    (href: string) => {
      void confirmDiscardChanges().then((discard) => {
        if (discard) router.replace(href);
      });
    },
    [router],
  );

  return { guardedPush, guardedReplace };
}
