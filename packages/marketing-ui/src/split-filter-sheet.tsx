"use client";

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
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@auction/ui/components/sheet";
import {
  type ReactElement,
  type ReactNode,
  type Ref,
  cloneElement,
  isValidElement,
  useCallback,
  useRef,
} from "react";
import { useSplitOverlayOpenLg } from "./hooks/use-split-overlay-open.js";

export type SplitFilterSheetFooterProps = {
  onReset?: () => void;
  resetLabel?: string;
  onApply?: () => void;
  applyLabel?: string;
  applyDisabled?: boolean;
  applyDisabledHint?: string;
};

export function SplitFilterSheetFooter({
  onReset,
  resetLabel = "Reset",
  onApply,
  applyLabel = "Apply",
  applyDisabled,
  applyDisabledHint,
}: SplitFilterSheetFooterProps) {
  return (
    <div className="flex flex-col gap-2 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {applyDisabledHint ? (
        <p className="font-body text-xs text-on-surface-variant">{applyDisabledHint}</p>
      ) : null}
      <div className="flex flex-row items-center justify-between gap-3">
        {onReset ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onReset}
            className="min-h-11 rounded-none px-0 font-label text-xs font-semibold text-link underline-offset-4 hover:bg-transparent hover:text-link hover:underline focus-visible:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:ring-0 focus-visible:ring-offset-0"
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
            className="min-h-11 shrink-0 px-6 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={applyDisabled}
            onClick={onApply}
          >
            {applyLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * `catalogue` follows the browse drawer in Figma (541:6507 desktop, 551:10071 mobile): a 600px
 * full-height drawer with Cancel + Apply, and a bottom sheet with "Reset all" in its header and
 * one full-width results button.
 */
export type SplitFilterSheetVariant = "default" | "catalogue";

export type SplitFilterSheetProps = {
  variant?: SplitFilterSheetVariant;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  trigger?: ReactNode;
  children: ReactNode;
  onApply?: () => void;
  applyLabel?: string;
  applyDisabled?: boolean;
  applyDisabledHint?: string;
  onReset?: () => void;
  resetLabel?: string;
  /** `catalogue` only: desktop footer button that closes without applying. */
  cancelLabel?: string;
  /** `catalogue` only: mobile results button text (defaults to `applyLabel`). */
  mobileApplyLabel?: string;
  className?: string;
};

function CatalogueDesktopFooter({
  cancelLabel,
  onApply,
  applyLabel,
  applyDisabled,
}: {
  cancelLabel: string;
  onApply?: (() => void) | undefined;
  applyLabel: string;
  applyDisabled?: boolean | undefined;
}) {
  return (
    <div className="flex items-center justify-end gap-3 px-10 py-6">
      <SheetClose asChild>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 px-4 font-label text-sm font-semibold"
        >
          {cancelLabel}
        </Button>
      </SheetClose>
      {onApply ? (
        <Button
          type="button"
          variant="cta"
          className="min-h-11 px-8 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={applyDisabled}
          onClick={onApply}
        >
          {applyLabel}
        </Button>
      ) : null}
    </div>
  );
}

function CatalogueMobileFooter({
  onApply,
  label,
  applyDisabled,
}: {
  onApply?: (() => void) | undefined;
  label: string;
  applyDisabled?: boolean | undefined;
}) {
  if (!onApply) return null;
  return (
    <div className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Button
        type="button"
        variant="cta"
        className="min-h-11 w-full disabled:cursor-not-allowed disabled:opacity-50"
        disabled={applyDisabled}
        onClick={onApply}
      >
        {label}
      </Button>
    </div>
  );
}

const titleClass = "font-label text-xs font-medium text-on-surface";

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (value: T) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(value);
      else if (ref && typeof ref === "object") {
        (ref as { current: T | null }).current = value;
      }
    }
  };
}

function attachTriggerRef(node: ReactNode, ref: Ref<HTMLElement>): ReactNode {
  if (!node || !isValidElement(node)) return node;
  const el = node as ReactElement<{ ref?: Ref<HTMLElement> }>;
  return cloneElement(el, {
    ref: mergeRefs(ref, el.props.ref),
  });
}

/** Bottom sheet below `lg`, right drawer at `lg+` — aligns with shell chrome breakpoint. */
export function SplitFilterSheet({
  variant = "default",
  open,
  onOpenChange,
  title = "Filters",
  description,
  trigger,
  children,
  onApply,
  applyLabel = "Apply",
  applyDisabled,
  applyDisabledHint,
  onReset,
  resetLabel = "Reset",
  cancelLabel = "Cancel",
  mobileApplyLabel,
  className,
}: SplitFilterSheetProps) {
  const catalogue = variant === "catalogue";
  const triggerRef = useRef<HTMLElement | null>(null);
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

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
      {...(applyDisabledHint ? { applyDisabledHint } : {})}
    />
  );

  const { mobile, desktop } = useSplitOverlayOpenLg(open, handleOpenChange);
  const wrappedTrigger = trigger ? attachTriggerRef(trigger, triggerRef) : null;

  return (
    <>
      <BottomSheet {...mobile}>
        {wrappedTrigger ? (
          <BottomSheetTrigger asChild className="lg:hidden">
            {wrappedTrigger}
          </BottomSheetTrigger>
        ) : null}
        <BottomSheetContent
          footer={
            catalogue ? (
              <CatalogueMobileFooter
                onApply={onApply}
                label={mobileApplyLabel ?? applyLabel}
                applyDisabled={applyDisabled}
              />
            ) : (
              footer
            )
          }
          overlayClassName="lg:hidden"
          className={cn(
            "h-[min(90dvh,640px)] max-h-[min(90dvh,640px)] border-border-hairline bg-surface-container-lowest lg:hidden",
            className,
          )}
        >
          {catalogue ? (
            <BottomSheetHeader className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center space-y-0 border-b border-border-hairline px-4 pb-3">
              <div className="justify-self-start">
                {onReset ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onReset}
                    className="min-h-11 px-0 font-body text-sm font-normal text-on-surface-variant hover:bg-transparent hover:text-on-surface"
                  >
                    {resetLabel}
                  </Button>
                ) : null}
              </div>
              <BottomSheetTitle className="font-body text-base font-semibold text-on-surface">
                {title}
              </BottomSheetTitle>
              <BottomSheetDescription className="sr-only">
                {resolvedDescription}
              </BottomSheetDescription>
            </BottomSheetHeader>
          ) : (
            <BottomSheetHeader className="shrink-0 border-b border-border-hairline px-6 py-4 text-left">
              <BottomSheetTitle className={titleClass}>{title}</BottomSheetTitle>
              <BottomSheetDescription
                className={cn("text-sm text-on-surface-variant", !onApply && "sr-only")}
              >
                {resolvedDescription}
              </BottomSheetDescription>
            </BottomSheetHeader>
          )}
          <div className={catalogue ? "px-4 py-2" : "px-6 py-4"}>{children}</div>
        </BottomSheetContent>
      </BottomSheet>

      <Sheet {...desktop}>
        {wrappedTrigger ? (
          <SheetTrigger asChild className="hidden lg:inline-flex">
            {wrappedTrigger}
          </SheetTrigger>
        ) : null}
        <SheetContent
          side="right"
          overlayClassName="hidden lg:block"
          className={cn(
            "hidden flex-col gap-0 border-border-hairline bg-surface-container-lowest p-0 lg:flex",
            catalogue
              ? "h-full w-full sm:max-w-none lg:w-[37.5rem] lg:max-w-[37.5rem]"
              : "max-h-[min(90dvh,640px)] max-w-sm",
            className,
          )}
        >
          <SheetHeader
            className={cn(
              "shrink-0 text-left",
              catalogue
                ? "px-10 pt-6 pb-2 pr-14"
                : "border-b border-border-hairline px-6 py-4 pr-12",
            )}
          >
            <SheetTitle className={cn(titleClass, catalogue && "sr-only")}>{title}</SheetTitle>
            <SheetDescription
              className={cn(
                "text-sm text-on-surface-variant",
                (catalogue || !onApply) && "sr-only",
              )}
            >
              {resolvedDescription}
            </SheetDescription>
          </SheetHeader>
          <div
            className={cn("min-h-0 flex-1 overflow-y-auto", catalogue ? "px-10 py-4" : "px-6 py-4")}
            {...(catalogue ? { "data-lenis-prevent": true } : {})}
          >
            {children}
          </div>
          <div className={cn("shrink-0", !catalogue && "border-t border-border-hairline")}>
            {catalogue ? (
              <CatalogueDesktopFooter
                cancelLabel={cancelLabel}
                onApply={onApply}
                applyLabel={applyLabel}
                applyDisabled={applyDisabled}
              />
            ) : (
              footer
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
