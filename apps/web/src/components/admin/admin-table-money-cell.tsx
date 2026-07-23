"use client";

import type { AdminTableMoneyDisplay } from "@/lib/admin/format-admin-table-money";
import { cn } from "@auction/ui";

type Props = {
  display: AdminTableMoneyDisplay;
  align?: "left" | "right";
  emphasis?: "default" | "hammer" | "muted";
  className?: string;
};

const emphasisClassName: Record<NonNullable<Props["emphasis"]>, string> = {
  hammer: "font-headline text-sm font-semibold tabular-nums text-on-surface",
  default: "font-label text-sm tabular-nums text-on-surface",
  muted: "font-label text-sm tabular-nums text-on-surface-variant",
};

export function AdminTableMoneyCell({
  display,
  align = "left",
  emphasis = "default",
  className,
}: Props) {
  const { primary, secondary } = display;

  return (
    <span className={cn("block min-w-0", align === "right" && "text-right", className)}>
      <span className={cn("block whitespace-nowrap", emphasisClassName[emphasis])}>{primary}</span>
      {secondary ? (
        <span className="block whitespace-nowrap font-label text-[11px] tabular-nums text-on-surface-variant">
          {secondary}
        </span>
      ) : null}
    </span>
  );
}
