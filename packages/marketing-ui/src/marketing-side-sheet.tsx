"use client";

import { cn } from "@auction/ui";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@auction/ui/components/bottom-sheet";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@auction/ui/components/sheet";
import { type ReactNode, type RefObject, useCallback } from "react";
import { useSplitOverlayOpenLg } from "./hooks/use-split-overlay-open.js";

export type MarketingSideSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** `sentence` sets the title as a plain heading (Figma enquiry panels); `label` is the default 12px label style. */
  titleCase?: "label" | "sentence";
  description?: string;
  children: ReactNode;
  /** Sticky actions below the scroll body. */
  footer?: ReactNode;
  /** Element that opened the sheet; focus returns here on close. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
};

const TITLE_CLASS = {
  label: "font-label text-xs font-medium text-on-surface",
  sentence: "text-2xl font-medium leading-8 text-on-surface",
} as const;

/** Bottom sheet below `lg`, 576px right side sheet at `lg+` — task panels (enquiry, forms). */
export function MarketingSideSheet({
  open,
  onOpenChange,
  title,
  titleCase = "label",
  description,
  children,
  footer,
  returnFocusRef,
  className,
}: MarketingSideSheetProps) {
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && returnFocusRef) {
        requestAnimationFrame(() => returnFocusRef.current?.focus());
      }
      onOpenChange(next);
    },
    [onOpenChange, returnFocusRef],
  );
  const titleClass = TITLE_CLASS[titleCase];
  const { mobile, desktop } = useSplitOverlayOpenLg(open, handleOpenChange);

  return (
    <>
      <BottomSheet {...mobile}>
        <BottomSheetContent
          overlayClassName="lg:hidden"
          {...(footer ? { footer } : {})}
          className={cn(
            "max-h-[min(92dvh,720px)] border-border-hairline bg-surface-container-lowest lg:hidden",
            className,
          )}
        >
          <BottomSheetHeader className="shrink-0 border-b border-border-hairline px-6 py-4 text-left">
            <BottomSheetTitle className={titleClass}>{title}</BottomSheetTitle>
            <BottomSheetDescription
              className={cn("text-sm text-on-surface-variant", !description && "sr-only")}
            >
              {description ?? title}
            </BottomSheetDescription>
          </BottomSheetHeader>
          <div className="px-6 py-4">{children}</div>
        </BottomSheetContent>
      </BottomSheet>

      <Sheet {...desktop}>
        <SheetContent
          side="right"
          overlayClassName="hidden lg:block"
          data-testid="marketing-side-sheet"
          className={cn(
            "hidden w-full flex-col gap-0 border-border-hairline bg-surface-container-lowest p-0 sm:max-w-none lg:flex lg:w-[36rem] lg:max-w-[36rem]",
            className,
          )}
        >
          <SheetHeader className="shrink-0 border-b border-border-hairline px-6 py-5 pr-14 text-left">
            <SheetTitle className={titleClass}>{title}</SheetTitle>
            <SheetDescription
              className={cn("text-sm text-on-surface-variant", !description && "sr-only")}
            >
              {description ?? title}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5" data-lenis-prevent>
            {children}
          </div>
          {footer ? <div className="shrink-0 border-t border-border-hairline">{footer}</div> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
