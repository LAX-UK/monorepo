"use client";

import { useCallback, useEffect, useState } from "react";

export type ShareStatus = "idle" | "copied" | "error";

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Shares a link with the device's share sheet where there is one, and copies it otherwise. The
 * outcome returns to idle after a moment so the button can say "Link copied" and then go back.
 */
export function useShareLink(input: { url: string; title: string }): {
  status: ShareStatus;
  share: () => Promise<void>;
} {
  const [status, setStatus] = useState<ShareStatus>("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  const share = useCallback(async () => {
    setStatus("idle");
    const url = new URL(input.url, window.location.href).toString();
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: input.title, url });
          return;
        } catch (error) {
          if (isAbort(error)) return;
          throw error;
        }
      }
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }, [input.title, input.url]);

  return { status, share };
}
