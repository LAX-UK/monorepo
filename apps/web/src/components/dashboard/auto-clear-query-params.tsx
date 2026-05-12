"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Strips one or more query parameters from the URL after the first paint.
 *
 * Used by settings to surface a one-shot success banner from a redirect
 * (e.g. `?linked=google`) without leaving the param visible on refresh.
 */
export function AutoClearQueryParams({ params }: { params: ReadonlyArray<string> }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    let changed = false;
    for (const key of params) {
      if (next.has(key)) {
        next.delete(key);
        changed = true;
      }
    }
    if (!changed) return;
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router, searchParams]);

  return null;
}
