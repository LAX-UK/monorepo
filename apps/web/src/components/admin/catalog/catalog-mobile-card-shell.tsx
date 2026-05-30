"use client";

import { cn } from "@auction/ui";
import { Checkbox } from "@auction/ui/components/checkbox";
import type { ReactNode } from "react";

type Props = {
  id: string;
  title: string;
  selected?: boolean | undefined;
  onSelectedChange?: ((checked: boolean) => void) | undefined;
  selectionLabel: string;
  meta?: ReactNode;
  status?: ReactNode;
  trailing?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** Shared mobile list card chrome for admin catalog boards. */
export function CatalogMobileCardShell({
  id: _id,
  title: _title,
  selected,
  onSelectedChange,
  selectionLabel,
  meta,
  status,
  trailing,
  footer,
  children,
  className,
}: Props) {
  const showSelection = Boolean(onSelectedChange);

  return (
    <li
      className={cn(
        "rounded-lg border border-border-hairline bg-surface-container-low/30 p-3",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {showSelection ? (
            <Checkbox
              className="mt-1 min-h-11 min-w-11"
              checked={Boolean(selected)}
              onCheckedChange={(checked) => onSelectedChange?.(checked === true)}
              aria-label={selectionLabel}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            {children}
            {meta ? <div className="mt-1">{meta}</div> : null}
            {status ? <div className="mt-2">{status}</div> : null}
          </div>
        </div>
        {trailing}
      </div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </li>
  );
}
