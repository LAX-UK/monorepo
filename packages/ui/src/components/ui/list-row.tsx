"use client";

import type * as React from "react";
import { cn } from "../../lib/utils.js";

export type ListRowProps = {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  value?: React.ReactNode;
  trailing?: React.ReactNode;
  onAction?: () => void;
  disabled?: boolean;
  className?: string;
};

export function ListRow({
  leading,
  title,
  subtitle,
  value,
  trailing,
  onAction,
  disabled,
  className,
}: ListRowProps) {
  const interactive = Boolean(onAction) && !disabled;

  const rowClass = cn(
    "flex w-full min-h-[var(--tap-target-min,44px)] items-center gap-3 px-4 py-3 text-left",
    "border-b border-border-hairline last:border-b-0",
    interactive &&
      "cursor-pointer transition-colors hover:bg-surface-container-high/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
    disabled && "pointer-events-none opacity-50",
    className,
  );

  const inner = (
    <>
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block font-body text-sm font-medium text-on-surface">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block font-body text-xs text-on-surface-variant">{subtitle}</span>
        ) : null}
      </span>
      {value ? (
        <span className="shrink-0 font-body text-sm text-on-surface-variant">{value}</span>
      ) : null}
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </>
  );

  if (interactive) {
    return (
      <button type="button" className={rowClass} onClick={onAction} disabled={disabled}>
        {inner}
      </button>
    );
  }

  return <div className={rowClass}>{inner}</div>;
}
