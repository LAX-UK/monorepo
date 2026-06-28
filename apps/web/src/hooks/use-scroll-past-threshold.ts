"use client";

import { useEffect, useState } from "react";

export function useScrollPastThreshold(thresholdPx: number): boolean {
  const [past, setPast] = useState(false);

  useEffect(() => {
    const handler = () => setPast(window.scrollY > thresholdPx);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [thresholdPx]);

  return past;
}
