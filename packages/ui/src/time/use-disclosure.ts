"use client";

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

export type Disclosure = {
  open: boolean;
  toggle: () => void;
  close: (options?: { restoreFocus?: boolean }) => void;
  /** The control that opens the panel; focus returns to it. */
  triggerRef: RefObject<HTMLButtonElement | null>;
  /** The element holding both the control and the panel. */
  rootRef: RefObject<HTMLSpanElement | null>;
};

/**
 * A non-modal disclosure: the panel opens beside the control and nothing behind it is locked.
 * Escape closes it and returns focus to the control; a press outside, or Tab out of it, closes it
 * without taking focus from where the visitor went.
 */
export function useDisclosure(): Disclosure {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLSpanElement | null>(null);

  const close = useCallback((options?: { restoreFocus?: boolean }) => {
    setOpen(false);
    if (options?.restoreFocus) triggerRef.current?.focus();
  }, []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close({ restoreFocus: true });
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open, close]);

  return { open, toggle, close, triggerRef, rootRef };
}
