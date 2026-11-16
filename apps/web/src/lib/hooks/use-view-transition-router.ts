"use client";

import { withViewTransition } from "@/lib/view-transition-runtime";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

type NavigateOptions = Parameters<ReturnType<typeof useRouter>["push"]>[1];

/**
 * Starts an admin navigation marked `<html data-view-transition="admin">`, so the page cross-fade
 * runs at the staff timing. The marker is set inside the update and cleared when the transition
 * settles (see `view-transition-runtime.ts` for why that order needs no guard).
 */
function adminViewTransition(navigate: () => void): void {
  const root = document.documentElement;
  const clear = () => {
    delete root.dataset.viewTransition;
  };
  const transition = withViewTransition(() => {
    root.dataset.viewTransition = "admin";
    navigate();
  });
  // Without a transition (reduced motion, no support) the update ran plainly: clear at once.
  if (transition) void transition.finished.then(clear, clear);
  else clear();
}

/** Router wrapper that cross-fades admin navigations when View Transitions API is supported. */
export function useViewTransitionRouter() {
  const router = useRouter();

  const push = useCallback(
    (href: string, options?: NavigateOptions) => {
      adminViewTransition(() => router.push(href, options));
    },
    [router],
  );

  const replace = useCallback(
    (href: string, options?: NavigateOptions) => {
      adminViewTransition(() => router.replace(href, options));
    },
    [router],
  );

  return useMemo(
    () => ({
      ...router,
      push,
      replace,
    }),
    [router, push, replace],
  );
}
