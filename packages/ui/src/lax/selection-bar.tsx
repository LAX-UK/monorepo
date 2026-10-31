"use client";

import { X } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/utils.js";
import { Button } from "./button.js";

/**
 * The bar that appears while rows of a list are picked: how many, a way to clear the pick, and
 * the actions that apply to all of them. It stays in reach at the bottom of the window (above
 * the phone tab bar) and is announced when the count changes.
 */
export function SelectionBar({
  count,
  noun,
  onClear,
  children,
  className,
}: {
  /** How many rows are picked; the bar is not shown for none. */
  count: number;
  /** What is picked, singular and plural: ["notification", "notifications"]. */
  noun: readonly [string, string];
  onClear: () => void;
  /** The actions, as buttons; the last is the main one. */
  children: React.ReactNode;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <section
      aria-label={`Selected ${noun[1]}`}
      className={cn(
        "sticky bottom-4 z-20 flex flex-col gap-3 rounded-lax-card border border-lax-line-strong bg-lax-surface p-3 shadow-lax-md",
        "sm:flex-row sm:items-center sm:justify-between max-lg:bottom-20",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={onClear}>
          <X aria-hidden />
        </Button>
        <p aria-live="polite" className="text-lax-14 font-medium tabular-nums text-lax-fg">
          {count} {count === 1 ? noun[0] : noun[1]} selected
        </p>
      </div>
      <div className="flex gap-2 max-sm:[&>*]:flex-1">{children}</div>
    </section>
  );
}
