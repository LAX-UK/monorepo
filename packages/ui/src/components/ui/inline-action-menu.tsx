"use client";

import { MoreHorizontal } from "lucide-react";
import { useId } from "react";
import { cn } from "../../lib/utils.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu.js";

export type InlineActionMenuItem =
  | { type: "item"; label: string; onSelect: () => void; disabled?: boolean; destructive?: boolean }
  | { type: "separator" };

export type InlineActionMenuProps = {
  items: readonly InlineActionMenuItem[];
  /** Accessible label for the trigger */
  label: string;
  className?: string;
};

function neighborLabels(
  items: readonly InlineActionMenuItem[],
  i: number,
): { prev: string; next: string } {
  let prev = "";
  for (let j = i - 1; j >= 0; j--) {
    const x = items[j];
    if (x?.type === "item") {
      prev = x.label;
      break;
    }
  }
  let next = "";
  for (let j = i + 1; j < items.length; j++) {
    const x = items[j];
    if (x?.type === "item") {
      next = x.label;
      break;
    }
  }
  return { prev, next };
}

/** Row-level overflow menu; 44×44 minimum touch target. */
export function InlineActionMenu({ items, label, className }: InlineActionMenuProps) {
  const instanceId = useId();
  const itemOrdinalByLabel = new Map<string, number>();
  let separatorOrdinal = 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-transparent text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:size-10",
            className,
          )}
          aria-label={label}
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {items.map((it, i) => {
          if (it.type === "separator") {
            separatorOrdinal += 1;
            const { prev, next } = neighborLabels(items, i);
            return (
              <DropdownMenuSeparator
                key={`${instanceId}-sep-${label}-${prev}-${next}-ord${separatorOrdinal}`}
              />
            );
          }
          const n = (itemOrdinalByLabel.get(it.label) ?? 0) + 1;
          itemOrdinalByLabel.set(it.label, n);
          return (
            <DropdownMenuItem
              key={`${instanceId}-item-${label}-${it.label}-${n}`}
              {...(it.disabled ? { disabled: true } : {})}
              className={it.destructive ? "text-live-red focus:text-live-red" : undefined}
              onSelect={(e) => {
                e.preventDefault();
                it.onSelect();
              }}
            >
              {it.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
