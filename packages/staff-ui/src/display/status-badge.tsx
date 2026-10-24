import type * as React from "react";
import { cn } from "../lib/cn.js";
import type { StaffStatusTone } from "../tokens.js";

const toneClass: Record<StaffStatusTone, { badge: string; dot: string }> = {
  neutral: { badge: "bg-staff-neutral-bg text-staff-neutral-fg", dot: "bg-staff-neutral-dot" },
  info: { badge: "bg-staff-info-bg text-staff-info-fg", dot: "bg-staff-info-dot" },
  success: { badge: "bg-staff-success-bg text-staff-success-fg", dot: "bg-staff-success-dot" },
  warning: { badge: "bg-staff-warning-bg text-staff-warning-fg", dot: "bg-staff-warning-dot" },
  danger: { badge: "bg-staff-danger-bg text-staff-danger-fg", dot: "bg-staff-danger-dot" },
};

/**
 * A status as a tinted label with a dot: 20px high, sentence case, never colour alone (the label
 * always names the state). `live` pulses the dot for something happening now.
 */
export function StatusBadge({
  tone,
  children,
  live = false,
  className,
}: {
  tone: StaffStatusTone;
  children: React.ReactNode;
  live?: boolean;
  className?: string;
}) {
  const classes = toneClass[tone];
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-full shrink-0 items-center gap-1.5 rounded-staff-xs px-1.5 font-staff text-staff-xs font-medium whitespace-nowrap",
        classes.badge,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          live ? "animate-pulse bg-staff-live-dot" : classes.dot,
        )}
      />
      <span className="truncate">{children}</span>
    </span>
  );
}

export type StatusPresentation = { label: string; tone: StaffStatusTone; live?: boolean };

/**
 * One mapping per domain status (order, fulfilment, lot, account…). Each app declares its own
 * table; a status the API adds later still renders, as its humanised name in the neutral tone,
 * rather than breaking the page.
 */
export function defineStatusMap<T extends string>(
  map: Readonly<Record<T, StatusPresentation>>,
): (status: string) => StatusPresentation {
  return (status) =>
    (map as Readonly<Record<string, StatusPresentation | undefined>>)[status] ?? {
      label: humanizeStatus(status),
      tone: "neutral",
    };
}

/** "partially_refunded" → "Partially refunded". */
export function humanizeStatus(status: string): string {
  const words = status.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function MappedStatusBadge({
  status,
  present,
  className,
}: {
  status: string;
  present: (status: string) => StatusPresentation;
  className?: string;
}) {
  const { label, tone, live } = present(status);
  return (
    <StatusBadge tone={tone} live={live ?? false} {...(className ? { className } : {})}>
      {label}
    </StatusBadge>
  );
}
