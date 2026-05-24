import type { RefObject } from "react";
import { useEffect } from "react";

export function useClickOutside(
  enabled: boolean,
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
) {
  useEffect(() => {
    if (!enabled) return;
    const onDoc = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [enabled, onOutside, ref]);
}
