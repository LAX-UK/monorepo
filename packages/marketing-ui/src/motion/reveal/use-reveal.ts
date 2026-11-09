"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { whenReaderMoves } from "./reader-intent.js";
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
    const arm = () => {
      if (!el.hasAttribute("data-revealed")) el.setAttribute("data-reveal-init", "true");
    };
    if (trigger.armWhen === "reader-moves") return whenReaderMoves(arm);
    arm();
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
