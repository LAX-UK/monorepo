"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-reads the page when the person comes back to the tab, so progress moves on without a live
 * connection. It renders nothing.
 */
export function RefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return null;
}
