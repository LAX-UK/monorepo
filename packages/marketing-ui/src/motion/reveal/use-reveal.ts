"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { whenReaderMoves } from "./reader-intent.js";
import type { RevealTrigger } from "./triggers.js";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function useReveal<T extends HTMLElement>(trigger: RevealTrigger) {
  const ref = useRef<T | null>(null);
  const staticRef = useRef(false);
  /** Whether the element has been hidden ready to animate in. */
  const armedRef = useRef(false);
  const cancelArmRef = useRef<() => void>(() => {});

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (trigger.isSatisfiedOnArm?.(el)) {
      staticRef.current = true;
      return;
    }
    const arm = () => {
      armedRef.current = true;
      if (!el.hasAttribute("data-revealed")) el.setAttribute("data-reveal-init", "true");
    };
    if (trigger.armWhen === "reader-moves") {
      cancelArmRef.current = whenReaderMoves(arm);
      return () => cancelArmRef.current();
    }
    arm();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || staticRef.current) return;
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      if (!armedRef.current) {
        // It came into view before it was ever hidden. Leave it exactly as drawn, with no entrance
        // to play (which would blank it out and bring it back), and never hide it afterwards.
        cancelArmRef.current();
        el.setAttribute("data-reveal-static", "true");
        return;
      }
      el.setAttribute("data-revealed", "true");
    };
    const cleanup = trigger.bind(el, reveal);
    return () => {
      cleanup();
    };
  }, [trigger]);

  return ref;
}
