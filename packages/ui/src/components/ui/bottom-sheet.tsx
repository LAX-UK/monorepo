"use client";

import { X } from "lucide-react";
import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "../../lib/utils.js";

/** Above fixed site chrome (`z-50`). Matches `--z-overlay` in apps/web globals. */
const overlayZClass = "z-[60]";

const BottomSheet = ({
  shouldScaleBackground = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />
);
BottomSheet.displayName = "BottomSheet";

const BottomSheetTrigger = DrawerPrimitive.Trigger;
const BottomSheetClose = DrawerPrimitive.Close;
const BottomSheetPortal = DrawerPrimitive.Portal;

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduce;
}

type BottomSheetContentProps = React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
  overlayClassName?: string;
  /** Sticky region below the scroll body (e.g. Apply / Done). */
  footer?: React.ReactNode;
};

const BottomSheetContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  BottomSheetContentProps
>(({ className, overlayClassName, footer, children, ...props }, ref) => {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <BottomSheetPortal>
      <DrawerPrimitive.Overlay
        className={cn("fixed inset-0 bg-black/40", overlayZClass, overlayClassName)}
      />
      <DrawerPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-x-0 bottom-0 flex max-h-[min(92dvh,720px)] flex-col gap-0 rounded-t-2xl border-t border-outline-variant/20 bg-surface-container-lowest shadow-lg outline-none",
          overlayZClass,
          className,
        )}
        {...props}
      >
        <div className="sticky top-0 z-10 flex shrink-0 flex-col items-center bg-surface-container-lowest/95 backdrop-blur supports-[backdrop-filter]:bg-surface-container-lowest/80">
          {reduceMotion ? (
            <div
              className="mb-2 mt-3 h-1.5 w-9 shrink-0 rounded-full bg-outline-variant/60"
              aria-hidden
            />
          ) : (
            <DrawerPrimitive.Handle className="mb-2 mt-3 h-1.5 w-9 shrink-0 rounded-full bg-outline-variant/60" />
          )}
          <div className="flex w-full items-center justify-end px-3 pb-2">
            <DrawerPrimitive.Close
              className="inline-flex size-10 items-center justify-center rounded-full border border-outline-variant/40 bg-surface-container-high/90 text-on-surface shadow-sm transition-colors hover:bg-surface-container-highest focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label="Close"
            >
              <X className="size-5" aria-hidden />
              <span className="sr-only">Close</span>
            </DrawerPrimitive.Close>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-outline-variant/20 bg-surface-container-lowest">
            {footer}
          </div>
        ) : null}
      </DrawerPrimitive.Content>
    </BottomSheetPortal>
  );
});
BottomSheetContent.displayName = "BottomSheetContent";

const BottomSheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
BottomSheetHeader.displayName = "BottomSheetHeader";

const BottomSheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
BottomSheetFooter.displayName = "BottomSheetFooter";

const BottomSheetTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-on-surface", className)}
    {...props}
  />
));
BottomSheetTitle.displayName = "BottomSheetTitle";

const BottomSheetDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-on-surface-variant", className)}
    {...props}
  />
));
BottomSheetDescription.displayName = "BottomSheetDescription";

export {
  BottomSheet,
  BottomSheetPortal,
  BottomSheetTrigger,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetFooter,
  BottomSheetTitle,
  BottomSheetDescription,
};
