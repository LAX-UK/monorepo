"use client";

import { useEffect, useRef, useState } from "react";

export type DashboardFilterLiveRegionProps = {
  /** Message to announce (e.g. result count label). */
  message: string;
  /** Debounce ms before announcing after message changes. */
  debounceMs?: number;
};

/** Debounced polite live region for filter result feedback. */
export function DashboardFilterLiveRegion({
  message,
  debounceMs = 400,
}: DashboardFilterLiveRegionProps) {
  const [announcement, setAnnouncement] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!message) {
      setAnnouncement("");
      return;
    }
    timeoutRef.current = setTimeout(() => {
      setAnnouncement(message);
    }, debounceMs);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [debounceMs, message]);

  return (
    <output className="sr-only" aria-live="polite" aria-atomic="true">
      {announcement}
    </output>
  );
}
