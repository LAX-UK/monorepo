"use client";

import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type Props = {
  visible: boolean;
  children: ReactNode;
  className?: string;
};

/** Smoothly hides countdown slots without layout jump on the Live pill. */
export function CountdownFadeSlot({ visible, children, className }: Props) {
  return (
    <span
      className={cn(
        "inline-block overflow-hidden transition-[max-width,opacity] duration-300 ease-out",
        visible ? "max-w-[12rem] opacity-100" : "max-w-0 opacity-0",
        className,
      )}
      aria-hidden={!visible}
    >
      {children}
    </span>
  );
}
