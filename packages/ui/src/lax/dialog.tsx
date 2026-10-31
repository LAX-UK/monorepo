"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/utils.js";
import { Button } from "./button.js";
import { useLayerAttributes } from "./density.js";
import { useReturnFocus } from "./return-focus.js";

export type DialogPlacement = "center" | "side";

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** One or two sentences under the title; read as the dialog's description. */
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** The actions, right-aligned on a hairline: Cancel, then the one primary. */
  footer?: React.ReactNode;
  /**
   * `center` is a dialog (520px, or 640px with `wide`); `side` is a sheet on the right (400px),
   * for filters. On a phone both become a bottom sheet with a grab handle.
   */
  placement?: DialogPlacement;
  wide?: boolean;
  /** Where focus lands on opening; by default the first focusable element. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
};

/** Phone first: a bottom sheet; from 768px a centred dialog or a right-hand sheet. */
const PLACEMENT: Record<DialogPlacement, string> = {
  center: cn(
    "md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:max-h-[calc(100dvh-4rem)] md:w-[calc(100%-4rem)] md:-translate-x-1/2 md:-translate-y-1/2",
    "md:rounded-lax-card md:border",
  ),
  side: cn(
    "md:inset-y-0 md:right-0 md:left-auto md:top-0 md:max-h-none md:w-[400px] md:max-w-[calc(100%-2rem)] md:border-t-0 md:border-l",
    "md:rounded-none",
  ),
};

/**
 * One dialog for the client workspace and the staff tools, as a focused task over the page. The
 * title and footer stay put while a tall body scrolls, so the actions are always in reach. On a
 * phone it rises from the bottom (grab handle, 16px top corners, safe-area padding); from 768px it
 * is a 12px-radius dialog, or a right-hand sheet for filters. Radix gives it the dialog role, a
 * focus trap, Escape to close and focus back on the control that opened it.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  placement = "center",
  wide = false,
  initialFocusRef,
}: DialogProps) {
  const layer = useLayerAttributes();
  const returnFocus = useReturnFocus(open);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          {...layer}
          className="fixed inset-0 z-[var(--z-overlay,60)] bg-lax-scrim"
        />
        <DialogPrimitive.Content
          {...layer}
          onCloseAutoFocus={returnFocus}
          data-placement={placement}
          {...(initialFocusRef
            ? {
                onOpenAutoFocus: (event: Event) => {
                  if (!initialFocusRef.current) return;
                  event.preventDefault();
                  initialFocusRef.current.focus();
                },
              }
            : {})}
          className={cn(
            "fixed inset-x-0 bottom-0 z-[var(--z-overlay,60)] flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden",
            "rounded-t-2xl border-t border-lax-line bg-lax-raised text-lax-fg shadow-lax-lg outline-none",
            "pb-[env(safe-area-inset-bottom,0px)] md:pb-0",
            PLACEMENT[placement],
            placement === "center" && (wide ? "md:max-w-[640px]" : "md:max-w-[520px]"),
          )}
        >
          <div aria-hidden className="flex justify-center pt-2 md:hidden" data-grab-handle="">
            <span className="h-1 w-9 rounded-full bg-lax-line-strong" />
          </div>
          <div className="flex shrink-0 items-start gap-3 px-4 pt-1 pb-3 md:px-6 md:pt-5">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <DialogPrimitive.Title className="font-lax-display text-lax-20 font-semibold text-balance text-lax-fg">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-lax-ui text-lax-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">
                  {title}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                className="-mr-1.5 shrink-0"
              >
                <X aria-hidden />
              </Button>
            </DialogPrimitive.Close>
          </div>
          {children ? (
            // A scrolling body must be reachable from the keyboard (WCAG 2.1.1, axe scrollable-region-focusable).
            <div
              // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region has to take focus to scroll by keyboard.
              tabIndex={0}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lax-focus md:px-6"
            >
              {children}
            </div>
          ) : null}
          {footer ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-lax-line px-4 py-3 md:px-6 md:py-4 [&>*]:max-md:flex-1">
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Closes the surrounding dialog; for a footer's Cancel. */
export const DialogClose = DialogPrimitive.Close;
