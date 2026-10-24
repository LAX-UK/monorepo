"use client";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@auction/ui/components/sheet";
import { X } from "lucide-react";
import type * as React from "react";
import { STAFF_LAYER, cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";

export type DetailPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  /** A line under the title: who, how much, when. */
  description?: React.ReactNode;
  /** Status badge(s) beside the title. */
  status?: React.ReactNode;
  /** Header actions beside close, e.g. "Open full page" and an overflow menu. */
  headerActions?: React.ReactNode;
  /** Sticky footer actions; the primary action last. */
  footer?: React.ReactNode;
  /** Wider for forms with side-by-side fields. */
  size?: "md" | "lg";
  children: React.ReactNode;
};

/**
 * Quick view and edit beside a list, without leaving it. Slides from the right at 480px (640px
 * for `lg`), full width on a phone. Focus moves into the panel on open and returns to the row
 * that opened it on close; Escape and the close button both close it.
 */
export function DetailPanel({
  open,
  onOpenChange,
  title,
  description,
  status,
  headerActions,
  footer,
  size = "md",
  children,
}: DetailPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        {...STAFF_LAYER}
        side="right"
        overlayClassName="bg-staff-scrim"
        className={cn(
          "flex w-full max-w-none flex-col gap-0 border-l border-staff-line bg-staff-surface p-0 text-staff-fg shadow-staff-lg sm:max-w-none",
          size === "lg" ? "sm:w-[640px]" : "sm:w-[480px]",
          "[&>button:last-child]:hidden",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-start gap-3 border-b border-staff-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="font-staff-display text-staff-lg font-semibold text-staff-fg">
                  {title}
                </SheetTitle>
                {status}
              </div>
              {description ? (
                <SheetDescription className="mt-0.5 text-staff-sm text-staff-muted">
                  {description}
                </SheetDescription>
              ) : (
                <SheetDescription className="sr-only">Details</SheetDescription>
              )}
            </div>
            <div className="-mt-1 -mr-2 flex shrink-0 items-center gap-1">
              {headerActions}
              <SheetClose asChild>
                <StaffButton variant="ghost" size="icon-sm" aria-label="Close panel">
                  <X aria-hidden />
                </StaffButton>
              </SheetClose>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5" data-lenis-prevent>
            {children}
          </div>
          {footer ? (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-staff-line bg-staff-surface px-5 py-3">
              {footer}
            </footer>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** A labelled block inside a panel: small heading, content below, 24px apart from the next. */
export function PanelSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 not-first:mt-6">
      <div className="flex min-h-control-xs items-center justify-between gap-2">
        <h3 className="text-staff-xs font-medium text-staff-muted">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
