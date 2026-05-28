"use client";

import { useSplitOverlayOpenLg } from "@/hooks/use-split-overlay-open";
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

export type SplitFilterSheetFooterProps = {
  onReset?: () => void;
  resetLabel?: string;
  onApply?: () => void;
  applyLabel?: string;
  applyDisabled?: boolean;
};

export function SplitFilterSheetFooter({
  onReset,
  resetLabel = "Reset",
  onApply,
  applyLabel = "Apply",
  applyDisabled,
}: SplitFilterSheetFooterProps) {
  return (
    <div className="flex flex-row items-center justify-between gap-3 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {onReset ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onReset}
          className="min-h-11 rounded-none px-0 font-label text-[0.65rem] font-semibold uppercase tracking-wider text-primary underline-offset-4 hover:bg-transparent hover:text-primary hover:underline focus-visible:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:ring-0 focus-visible:ring-offset-0"
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

export type SplitFilterSheetProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  trigger?: ReactNode;
  children: ReactNode;
  onApply?: () => void;
  applyLabel?: string;
  applyDisabled?: boolean;
  onReset?: () => void;
  resetLabel?: string;
  className?: string;
};

/** Bottom sheet below `lg`, right drawer at `lg+` — aligns with shell chrome breakpoint. */
export function SplitFilterSheet({
  open,
  onOpenChange,
  title = "Filters",
  description,
  trigger,
  children,
  onApply,
  applyLabel = "Apply",
  applyDisabled,
  onReset,
  resetLabel = "Reset",
  className,
}: SplitFilterSheetProps) {
  const resolvedDescription =
    description ??
    (onApply
      ? "Refine results, then tap Apply to update the list."
      : "Refine results. Changes apply when you confirm.");
  const footer = (
    <SplitFilterSheetFooter
      {...(onReset !== undefined ? { onReset } : {})}
      resetLabel={resetLabel}
      {...(onApply !== undefined ? { onApply } : {})}
      applyLabel={applyLabel}
      {...(applyDisabled !== undefined ? { applyDisabled } : {})}
    />
  );

  const { mobile, desktop } = useSplitOverlayOpenLg(open, onOpenChange);

  return (
    <>
      <BottomSheet {...mobile}>
        {trigger ? (
          <BottomSheetTrigger asChild className="lg:hidden">
            {trigger}
          </BottomSheetTrigger>
        ) : null}
        <BottomSheetContent
          footer={footer}
          overlayClassName="lg:hidden"
          className={cn(
            "h-[min(90dvh,640px)] max-h-[min(90dvh,640px)] border-border-hairline bg-surface-container-lowest lg:hidden",
            className,
          )}
        >
          <BottomSheetHeader className="shrink-0 border-b border-border-hairline px-6 py-4 text-left">
            <BottomSheetTitle className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface">
              {title}
            </BottomSheetTitle>
            <BottomSheetDescription
              className={cn("text-sm text-on-surface-variant", !onApply && "sr-only")}
            >
              {resolvedDescription}
            </BottomSheetDescription>
          </BottomSheetHeader>
          <div className="px-6 py-4">{children}</div>
        </BottomSheetContent>
      </BottomSheet>

      <Sheet {...desktop}>
        {trigger ? (
          <SheetTrigger asChild className="hidden lg:inline-flex">
            {trigger}
          </SheetTrigger>
        ) : null}
        <SheetContent
          side="right"
          overlayClassName="hidden lg:block"
          className={cn(
            "hidden max-h-[min(90dvh,640px)] max-w-sm flex-col gap-0 border-border-hairline bg-surface-container-lowest p-0 lg:flex",
            className,
          )}
        >
          <SheetHeader className="shrink-0 border-b border-border-hairline px-6 py-4 pr-12 text-left">
            <SheetTitle className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface">
              {title}
            </SheetTitle>
            <SheetDescription
              className={cn("text-sm text-on-surface-variant", !onApply && "sr-only")}
            >
              {resolvedDescription}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
          <div className="shrink-0 border-t border-border-hairline">{footer}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
