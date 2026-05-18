"use client";

import { useIsMd } from "@/hooks/use-is-md";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@auction/ui/components/sheet";
import type { ReactNode } from "react";

export type MarketingFilterSheetProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  trigger?: ReactNode;
  children: ReactNode;
  /** Primary apply action (e.g. submit form). */
  onApply?: () => void;
  applyLabel?: string;
  applyDisabled?: boolean;
  /** Reset / clear filters. */
  onReset?: () => void;
  resetLabel?: string;
  className?: string;
};

/** Bottom sheet on mobile, right drawer on `md+` — shared marketing filter surface. */
export function MarketingFilterSheet({
  open,
  onOpenChange,
  title = "Filters",
  trigger,
  children,
  onApply,
  applyLabel = "Apply",
  applyDisabled,
  onReset,
  resetLabel = "Reset",
  className,
}: MarketingFilterSheetProps) {
  const isMd = useIsMd();
  const side = isMd ? "right" : "bottom";

  return (
    <Sheet {...(open !== undefined ? { open } : {})} {...(onOpenChange ? { onOpenChange } : {})}>
      {trigger ? <SheetTrigger asChild>{trigger}</SheetTrigger> : null}
      <SheetContent
        side={side}
        overlayClassName="z-[60]"
        className={cn(
          "z-[60] flex max-h-[min(90dvh,640px)] flex-col gap-0 border-border-hairline bg-surface-container-lowest p-0",
          side === "bottom" && "h-[min(90dvh,640px)] rounded-t-2xl",
          side === "right" && "max-w-sm",
          className,
        )}
      >
        <SheetHeader className="shrink-0 border-b border-border-hairline px-6 py-4 pr-12 text-left">
          <SheetTitle className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface">
            {title}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Refine catalogue results. Changes apply when you confirm.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
        <SheetFooter className="shrink-0 flex-row items-center justify-between gap-3 border-t border-border-hairline px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:justify-between">
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="min-h-10 font-label text-[0.65rem] font-semibold uppercase tracking-wider text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {resetLabel}
            </button>
          ) : (
            <span />
          )}
          {onApply ? (
            <Button
              type="button"
              variant="cta"
              className="min-h-11 shrink-0 px-6"
              disabled={applyDisabled}
              onClick={onApply}
            >
              {applyLabel}
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
