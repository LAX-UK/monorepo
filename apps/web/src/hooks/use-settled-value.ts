"use client";

import { useEffect, useState } from "react";

/**
 * `value` once it has stopped changing for `delayMs`. For a live region that should speak once
 * typing pauses, not on every keystroke.
 */
export function useSettledValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
