"use client";

import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Star } from "lucide-react";
import { type CSSProperties, type HTMLAttributes, type ReactNode, forwardRef } from "react";

type Props = Omit<HTMLAttributes<HTMLLIElement>, "title"> & {
  media?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  orderLabel?: string;
  primaryLabel?: string;
  badge?: ReactNode;
  dragHandle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
  /** Subtle emphasis for catalogue hero (uniform grid footprint). */
  isHero?: boolean;
  /** Inspector or keyboard focus target. */
  isSelected?: boolean | undefined;
  onOpen?: (() => void) | undefined;
};

/** Consistent sortable/editable card frame used by catalogue media collections. */
export const CatalogMediaCard = forwardRef<HTMLLIElement, Props>(function CatalogMediaCard(
  {
    media,
    title,
    subtitle,
    orderLabel,
    primaryLabel,
    badge,
    dragHandle,
    actions,
    children,
    className,
    style,
    isHero = false,
    isSelected = false,
    onOpen,
    ...props
  },
  ref,
) {
  const interactive = Boolean(onOpen);

  return (
    <li
      ref={ref}
      style={style}
      className={cn(
        "group flex min-w-0 flex-col overflow-hidden rounded-shell-card border bg-surface-container-lowest shadow-[var(--shadow-rest)]",
        isHero ? "border-primary/40 ring-1 ring-primary/15" : "border-border-hairline",
        isSelected && "ring-2 ring-ring ring-offset-2 ring-offset-surface",
        interactive && "transition-shadow hover:shadow-[var(--shadow-hover)]",
        className,
      )}
      {...props}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-container-low">
        {media ?? (
          <div className="flex size-full items-center justify-center font-body text-sm text-on-surface-variant">
            No preview
          </div>
        )}
        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {orderLabel ? (
              <span className="rounded-full bg-surface-container-lowest/95 px-2 py-1 font-label text-[10px] font-semibold uppercase tracking-wide text-on-surface shadow-sm">
                {orderLabel}
              </span>
            ) : null}
            {primaryLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 font-label text-[10px] font-semibold uppercase tracking-wide text-on-primary shadow-sm">
                <Star className="size-3" aria-hidden />
                {primaryLabel}
              </span>
            ) : null}
            {badge}
          </div>
          {dragHandle}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="min-w-0">
          <h3 className="line-clamp-2 font-body text-sm font-semibold text-on-surface">
            {interactive ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpen?.()}
                className="h-auto min-h-11 justify-start p-0 text-left font-body text-sm font-semibold underline-offset-4 hover:bg-transparent hover:text-link hover:underline"
              >
                {title}
              </Button>
            ) : (
              title
            )}
          </h3>
          {subtitle ? (
            <div className="mt-1 font-body text-xs text-on-surface-variant">{subtitle}</div>
          ) : null}
        </div>
        {children ? <div className="mt-4 space-y-3">{children}</div> : null}
        {actions ? (
          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border-hairline pt-3">
            {actions}
          </div>
        ) : null}
      </div>
    </li>
  );
});
