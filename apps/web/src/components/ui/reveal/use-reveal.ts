"use client";

import type { RevealTrigger } from "@/components/ui/reveal/triggers";
import { useEffect, useLayoutEffect, useRef } from "react";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const FALLBACK_MS = 2500;

export function useReveal<T extends HTMLElement>(trigger: RevealTrigger) {
  const ref = useRef<T | null>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute("data-reveal-init", "true");
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      el.setAttribute("data-revealed", "true");
    };
    const cleanup = trigger.bind(el, reveal);
    const safety = window.setTimeout(reveal, FALLBACK_MS);
    return () => {
      window.clearTimeout(safety);
      cleanup();
    };
  }, [trigger]);

  return ref;
}
