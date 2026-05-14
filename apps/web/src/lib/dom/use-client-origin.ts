"use client";

import { useEffect, useState } from "react";

/**
 * Returns `window.location.origin` after mount, `""` during SSR and the first
 * client render. Use when an attribute value (e.g. an `href`) needs the
 * absolute origin but the component is server-rendered. Pairing the empty
 * fallback on both server and first client render avoids hydration mismatches;
 * after mount the state updates and the link gains the real origin.
 */
export function useClientOrigin(): string {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return origin;
}
