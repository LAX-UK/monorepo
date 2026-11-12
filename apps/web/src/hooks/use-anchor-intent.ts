"use client";

import { useEffect, useState } from "react";

const INTENT_EVENTS = ["pointerover", "pointerdown", "touchstart", "focusin"] as const;

/**
 * Whether someone is going to the section `targetId`: the address already names it, or a link to
 * `#targetId` has been pointed at, touched or focused. It starts `false` and, once `true`, stays
 * `true`. A part that is fetched as its section nears the screen uses it to start earlier when a
 * link jumps straight there, so the jump does not wait for the fetch.
 */
export function useAnchorIntent(targetId: string): boolean {
  const [intent, setIntent] = useState(false);
  useEffect(() => {
    if (intent) return;
    if (window.location.hash === `#${targetId}`) {
      setIntent(true);
      return;
    }
    const selector = `a[href="#${targetId}"]`;
    const onIntent = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(selector)) setIntent(true);
    };
    for (const name of INTENT_EVENTS) document.addEventListener(name, onIntent, { passive: true });
    return () => {
      for (const name of INTENT_EVENTS) document.removeEventListener(name, onIntent);
    };
  }, [intent, targetId]);
  return intent;
}
