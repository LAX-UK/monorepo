"use client";

import { withViewTransition } from "@/lib/view-transition-runtime";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

type NavigateOptions = Parameters<ReturnType<typeof useRouter>["push"]>[1];

/** Router wrapper that cross-fades admin navigations when View Transitions API is supported. */
export function useViewTransitionRouter() {
  const router = useRouter();

  const push = useCallback(
    (href: string, options?: NavigateOptions) => {
      withViewTransition(() => router.push(href, options));
    },
    [router],
  );

  const replace = useCallback(
    (href: string, options?: NavigateOptions) => {
      withViewTransition(() => router.replace(href, options));
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
