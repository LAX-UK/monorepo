"use client";

import { useSplitOverlayOpen } from "@/hooks/use-split-overlay-open";
import { cn } from "@auction/ui";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
} from "@auction/ui/components/bottom-sheet";
import { Button } from "@auction/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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

function FilterFooter({
  onReset,
  resetLabel = "Reset",
  onApply,
  applyLabel = "Apply",
  applyDisabled,
}: {
  onReset?: () => void;
  resetLabel?: string;
  onApply?: () => void;
  applyLabel?: string;
  applyDisabled?: boolean;
}) {
  return (
    <div className="flex flex-row items-center justify-between gap-3 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {onReset ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onReset}
          className="min-h-10 rounded-none px-0 font-label text-[0.65rem] font-semibold uppercase tracking-wider text-primary underline-offset-4 hover:bg-transparent hover:text-primary hover:underline focus-visible:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          {resetLabel}
        </Button>
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
    </div>
  );
}

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
  const footer = (
    <FilterFooter
      {...(onReset !== undefined ? { onReset } : {})}
      resetLabel={resetLabel}
      {...(onApply !== undefined ? { onApply } : {})}
      applyLabel={applyLabel}
      {...(applyDisabled !== undefined ? { applyDisabled } : {})}
    />
  );

  const { mobile, desktop } = useSplitOverlayOpen(open, onOpenChange);

  return (
    <>
      <BottomSheet {...mobile}>
        {trigger ? (
          <BottomSheetTrigger asChild className="md:hidden">
            {trigger}
          </BottomSheetTrigger>
        ) : null}
        <BottomSheetContent
          footer={footer}
          overlayClassName="md:hidden"
          className={cn(
            "md:hidden h-[min(90dvh,640px)] max-h-[min(90dvh,640px)] border-border-hairline bg-surface-container-lowest",
            className,
          )}
        >
          <BottomSheetHeader className="shrink-0 border-b border-border-hairline px-6 py-4 text-left">
            <BottomSheetTitle className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface">
              {title}
            </BottomSheetTitle>
            <BottomSheetDescription className="sr-only">
              Refine catalogue results. Changes apply when you confirm.
            </BottomSheetDescription>
          </BottomSheetHeader>
          <div className="px-6 py-4">{children}</div>
        </BottomSheetContent>
      </BottomSheet>

      <Sheet {...desktop}>
        {trigger ? (
          <SheetTrigger asChild className="hidden md:inline-flex">
            {trigger}
          </SheetTrigger>
        ) : null}
        <SheetContent
          side="right"
          overlayClassName="hidden md:block"
          className={cn(
            "hidden max-h-[min(90dvh,640px)] max-w-sm flex-col gap-0 border-border-hairline bg-surface-container-lowest p-0 md:flex",
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
          <div className="shrink-0 border-t border-border-hairline">{footer}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
