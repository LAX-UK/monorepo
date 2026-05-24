"use client";

import { useBottomChromeVars } from "@/hooks/use-bottom-chrome";
import { useEffect } from "react";

/** Syncs bottom chrome CSS variables on `document.documentElement` for consent + route context. */
export function BottomChromeSync() {
  const vars = useBottomChromeVars();

  useEffect(() => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    root.dataset.consentBanner =
      vars["--bottom-chrome-consent-offset"] !== "0px" ? "visible" : "hidden";
    return () => {
      for (const key of Object.keys(vars)) {
        root.style.removeProperty(key);
      }
      delete root.dataset.consentBanner;
    };
  }, [vars]);

  return null;
}
