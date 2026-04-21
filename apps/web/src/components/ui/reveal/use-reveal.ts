"use client";

import type { RevealTrigger } from "@/components/ui/reveal/triggers";
import { useEffect, useRef } from "react";

export function useReveal<T extends HTMLElement>(trigger: RevealTrigger) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reveal = () => {
      el.setAttribute("data-revealed", "true");
    };
    return trigger.bind(el, reveal);
  }, [trigger]);
  return ref;
}
