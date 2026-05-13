"use client";

import { useCallback, useEffect, useState } from "react";

/** Countdown in seconds; call `start()` after a successful resend. */
export function useResendCooldown(defaultSeconds = 45) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = window.setTimeout(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [remaining]);

  const start = useCallback(
    (seconds = defaultSeconds) => {
      setRemaining(seconds);
    },
    [defaultSeconds],
  );

  return { remaining, start };
}
