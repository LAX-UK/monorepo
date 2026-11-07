"use client";

import { type ReactNode, useEffect, useRef } from "react";

/**
 * Puts focus on its content when the page opens, for a message the person came back to read
 * (a payment that did not complete). The wrapper is not a tab stop of its own.
 */
export function FocusOnMount({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      {children}
    </div>
  );
}
