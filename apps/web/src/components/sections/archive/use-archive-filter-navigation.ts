"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

/** Pending client navigation for archive catalogue filters. */
export function useArchiveFilterNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const navigate = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [router],
  );

  const setParams = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === "" || v === "all") next.delete(k);
        else next.set(k, v);
      }
      next.delete("page");
      const qs = next.toString();
      navigate(qs ? `${pathname}?${qs}` : pathname);
    },
    [navigate, pathname, searchParams],
  );

  return { pending, navigate, setParams, pathname, searchParams };
}
