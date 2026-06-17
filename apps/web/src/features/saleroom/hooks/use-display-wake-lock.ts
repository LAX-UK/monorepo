"use client";

import { useEffect } from "react";

/** Keeps venue display screens awake (TV browsers). Re-acquires after tab visibility returns. */
export function useDisplayWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return;
    }

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        lock = await navigator.wakeLock.request("screen");
        lock.addEventListener("release", () => {
          lock = null;
        });
      } catch {
        /* unsupported or denied — non-fatal */
      }
    };

    void acquire();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void acquire();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void lock?.release();
    };
  }, [enabled]);
}
