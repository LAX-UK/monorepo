"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/** Refreshes server RSVP data when staff return from the check-in console. */
export function OnsiteEventRefreshOnReturn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refreshedRef = useRef(false);

  useEffect(() => {
    if (refreshedRef.current) return;
    if (searchParams.get("from") !== "check-in") return;

    refreshedRef.current = true;
    router.refresh();
    const next = new URL(window.location.href);
    next.searchParams.delete("from");
    router.replace(`${next.pathname}${next.search}`);
  }, [router, searchParams]);

  return null;
}
