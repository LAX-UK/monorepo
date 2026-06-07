"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Soft-refresh server data while submissions may change status. */
export function SubmissionsListAutoRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [enabled, router]);
  return null;
}
