"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { RevealTrigger } from "./triggers.js";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function useReveal<T extends HTMLElement>(trigger: RevealTrigger) {
  const ref = useRef<T | null>(null);
  const staticRef = useRef(false);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (trigger.isSatisfiedOnArm?.(el)) {
      staticRef.current = true;
      return;
    }
    el.setAttribute("data-reveal-init", "true");
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || staticRef.current) return;
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      el.setAttribute("data-revealed", "true");
    };
    const cleanup = trigger.bind(el, reveal);
    return () => {
      cleanup();
    };
  }, [trigger]);

  return ref;
}
