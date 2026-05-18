"use client";

import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils.js";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn("fixed inset-0 z-50 bg-black/40", className)}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

type SheetContentProps = React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
  /** Optional class names for the overlay (e.g. z-index above site chrome). */
  overlayClassName?: string;
};

const sheetSideClasses: Record<NonNullable<SheetContentProps["side"]>, string> = {
  top: "inset-x-0 top-0 border-b",
  bottom:
    "inset-x-0 bottom-0 flex max-h-[min(92dvh,720px)] flex-col gap-0 rounded-t-2xl border-t p-0",
  left: "inset-y-0 left-0 h-full w-3/4 max-w-sm border-r sm:max-w-sm",
  right: "inset-y-0 right-0 h-full w-3/4 max-w-sm border-l sm:max-w-sm",
};

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, overlayClassName, children, ...props }, ref) => {
  const isBottom = side === "bottom";

  return (
    <SheetPortal>
      <SheetOverlay className={overlayClassName} />
      <SheetPrimitive.Content
        ref={ref}
        className={cn(
          "fixed z-50 border-outline-variant/20 bg-surface-container-lowest shadow-lg transition-transform duration-300 ease-out",
          isBottom ? "gap-0 p-0" : "gap-4 p-6",
          sheetSideClasses[side],
          className,
        )}
        {...props}
      >
        {isBottom ? (
          <>
            <div className="sticky top-0 z-10 flex items-center justify-end gap-2 bg-surface-container-lowest/95 px-3 pt-[max(env(safe-area-inset-top,0px),0.5rem)] pb-2 backdrop-blur supports-[backdrop-filter]:bg-surface-container-lowest/80">
              <div
                className="pointer-events-none absolute left-1/2 top-2 h-1 w-9 -translate-x-1/2 rounded-full bg-outline-variant/60"
                aria-hidden
              />
              <SheetPrimitive.Close
                className="relative inline-flex size-10 items-center justify-center rounded-full border border-outline-variant/40 bg-surface-container-high/90 text-on-surface shadow-sm ring-offset-background transition-colors hover:bg-surface-container-highest focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none"
                aria-label="Close"
              >
                <X className="size-5" aria-hidden />
                <span className="sr-only">Close</span>
              </SheetPrimitive.Close>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
              {children}
            </div>
          </>
        ) : (
          <>
            {children}
            <SheetPrimitive.Close
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary"
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden />
              <span className="sr-only">Close</span>
            </SheetPrimitive.Close>
          </>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
});
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-on-surface", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-on-surface-variant", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
