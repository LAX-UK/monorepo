"use client";

import * as React from "react";

import { useMinWidthMd } from "../../hooks/use-media-query.js";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetTitle,
  BottomSheetTrigger,
} from "./bottom-sheet.js";
import { Popover, PopoverContent, PopoverTrigger } from "./popover.js";

export type ResponsivePickerShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactElement<{ disabled?: boolean; "aria-busy"?: boolean }>;
  panel: React.ReactNode;
  /** Shown below the panel on mobile sheet and desktop popover when provided. */
  footer?: React.ReactNode;
  /** Accessible title for the mobile bottom sheet. */
  sheetTitle: string;
  popoverContentClassName?: string;
};

/**
 * Desktop: anchored popover. Mobile: bottom sheet.
 * Mounts only one overlay — portaled drawers must not rely on CSS `md:hidden`.
 */
function ResponsivePickerShell({
  open,
  onOpenChange,
  trigger,
  panel,
  footer,
  sheetTitle,
  popoverContentClassName = "w-auto p-0",
}: ResponsivePickerShellProps) {
  const isDesktop = useMinWidthMd();

  if (isDesktop === null) {
    return React.cloneElement(trigger, { disabled: true, "aria-busy": true });
  }

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent className={popoverContentClassName} align="start">
          {panel}
          {footer ? (
            <div className="border-t border-outline-variant/25 p-3 pt-0">{footer}</div>
          ) : null}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetTrigger asChild>{trigger}</BottomSheetTrigger>
      <BottomSheetContent footer={footer}>
        <BottomSheetTitle className="sr-only">{sheetTitle}</BottomSheetTitle>
        {panel}
      </BottomSheetContent>
    </BottomSheet>
  );
}

export { ResponsivePickerShell };
