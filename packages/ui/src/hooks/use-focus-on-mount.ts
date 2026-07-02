"use client";

import { useEffect, useRef } from "react";

/** Moves focus to a heading (or any element) when a step/panel mounts. */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  return ref;
}
