"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/utils.js";
import { FilterChip } from "./filter-chip.js";

const CHIP_BASE =
  "inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border px-4 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const CHIP_ACTIVE = "border-primary/35 bg-primary-container/45 text-primary shadow-sm";
const CHIP_IDLE =
  "border-border-hairline bg-surface-container-low text-on-surface-variant hover:border-primary/25 hover:bg-surface-container-high hover:text-on-surface";

export type FilterRowLinkItem = {
  id: string;
  label: ReactNode;
  href: string;
  active?: boolean;
  badge?: ReactNode;
};

export type FilterRowToggleItem = {
  id: string;
  label: ReactNode;
  pressed?: boolean;
  pending?: boolean;
  disabled?: boolean;
};

export type FilterRowProps =
  | {
      mode: "link";
      items: readonly FilterRowLinkItem[];
      label: string;
      className?: string;
      /** Optional link renderer (e.g. Next.js Link) */
      renderLink?: (props: {
        href: string;
        className: string;
        children: ReactNode;
        "aria-current"?: "page";
      }) => ReactNode;
    }
  | {
      mode: "toggle";
      items: readonly FilterRowToggleItem[];
      label: string;
      className?: string;
      onToggle?: (id: string) => void;
    };

/** Unified filter chip row — URL links or controlled toggles. */
export function FilterRow(props: FilterRowProps) {
  const { label, className } = props;

  return (
    <fieldset
      className={cn(
        "flex min-w-0 flex-col gap-2 border-0 p-0 sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      <legend className="sr-only">{label}</legend>
      <div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible">
        {props.mode === "link"
          ? props.items.map((item) => {
              const classNameChip = cn(CHIP_BASE, item.active ? CHIP_ACTIVE : CHIP_IDLE);
              const content = (
                <>
                  <span>{item.label}</span>
                  {item.badge !== undefined ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] tracking-normal",
                        item.active
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container-high text-on-surface-variant",
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </>
              );

              if (props.renderLink) {
                return (
                  <span key={item.id} className="shrink-0">
                    {props.renderLink({
                      href: item.href,
                      className: classNameChip,
                      children: content,
                      ...(item.active ? { "aria-current": "page" as const } : {}),
                    })}
                  </span>
                );
              }

              return (
                <a
                  key={item.id}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={classNameChip}
                >
                  {content}
                </a>
              );
            })
          : props.items.map((item) => (
              <FilterChip
                key={item.id}
                {...(item.pressed !== undefined ? { pressed: item.pressed } : {})}
                {...(item.pending !== undefined ? { pending: item.pending } : {})}
                {...(item.disabled !== undefined ? { disabled: item.disabled } : {})}
                className={cn("shrink-0 tracking-[var(--text-label-caps-tracking,0.22em)]")}
                onClick={() => props.onToggle?.(item.id)}
              >
                {item.label}
              </FilterChip>
            ))}
      </div>
    </fieldset>
  );
}
