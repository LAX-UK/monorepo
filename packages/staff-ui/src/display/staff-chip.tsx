"use client";

import { X } from "lucide-react";
import type * as React from "react";
import type { StaffPermission } from "../access/staff-access.js";
import { cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";

export type StaffChipProps = {
  /** What the chip stands for: "Finance". */
  label: string;
  /** One quiet line under the label: "Since 3 Oct 2026 · Ends 30 Nov 2026". */
  meta?: React.ReactNode;
  /** `attention` for something the person should notice soon, such as an end date close by. */
  metaTone?: "muted" | "attention";
  /** Removes what the chip stands for; the chip shows an × button when given. */
  onRemove?: () => void;
  /** The remove button's name: "Remove the Finance role". */
  removeLabel?: string;
  /** Keeps the remove button visible but inert, and says why on hover and focus. */
  removeDisabledReason?: string;
  /** What removing needs; people without it see the chip without the button. */
  removeRequires?: StaffPermission;
  className?: string;
};

/**
 * A held item as a bordered chip: a label, an optional line of facts, and an optional remove
 * button (24px, always visible). Chips wrap in a row with an 8px gap.
 */
export function StaffChip({
  label,
  meta,
  metaTone = "muted",
  onRemove,
  removeLabel,
  removeDisabledReason,
  removeRequires,
  className,
}: StaffChipProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-control-md max-w-full items-center gap-2 rounded-staff-sm border border-staff-line-strong bg-staff-surface py-1 pl-2.5 font-staff",
        onRemove ? "pr-1" : "pr-2.5",
        className,
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-staff-sm font-medium text-staff-fg">{label}</span>
        {meta ? (
          <span
            className={cn(
              "truncate text-staff-xs",
              metaTone === "attention" ? "font-medium text-staff-warning-fg" : "text-staff-muted",
            )}
          >
            {meta}
          </span>
        ) : null}
      </span>
      {onRemove ? (
        <StaffButton
          variant="ghost"
          size="icon-xs"
          aria-label={removeLabel ?? `Remove ${label}`}
          onClick={onRemove}
          {...(removeDisabledReason ? { disabledReason: removeDisabledReason } : {})}
          {...(removeRequires ? { requires: removeRequires } : {})}
          className="text-staff-muted hover:text-staff-fg"
        >
          <X aria-hidden />
        </StaffButton>
      ) : null}
    </span>
  );
}
