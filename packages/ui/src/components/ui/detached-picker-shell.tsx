"use client";

import { X } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";

import { useMinWidthMd } from "../../hooks/use-media-query.js";
import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";
import {
  DESKTOP_PICKER_ESTIMATED_HEIGHT_PX,
  type DesktopPickerPosition,
  computeDesktopPickerPosition,
} from "./detached-picker-position.js";

/** Above fixed site chrome (`z-50`). Matches `--z-overlay` in apps/web globals. */
const overlayZClass = "z-[60]";

export type DetachedPickerShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactElement<{ disabled?: boolean; "aria-busy"?: boolean }>;
  anchorRef: React.RefObject<HTMLElement | null>;
  panel: React.ReactNode;
  footer?: React.ReactNode;
  sheetTitle: string;
  popoverContentClassName?: string;
};

/**
 * Responsive picker without Radix/Vaul `Trigger asChild` ref composition.
 * Desktop: fixed panel with viewport flip. Mobile: bottom sheet panel in a portal.
 */
function DetachedPickerShell({
  open,
  onOpenChange,
  trigger,
  anchorRef,
  panel,
  footer,
  sheetTitle,
  popoverContentClassName = "w-auto p-0",
}: DetachedPickerShellProps) {
  const isDesktop = useMinWidthMd();
  const prevDesktop = React.useRef(isDesktop);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [desktopLayout, setDesktopLayout] = React.useState<DesktopPickerPosition | null>(null);

  const updateDesktopLayout = React.useCallback(() => {
    const anchorEl = anchorRef.current;
    if (!anchorEl) {
      setDesktopLayout(null);
      return;
    }
    const anchorDom = anchorEl.getBoundingClientRect();
    const measuredHeight = panelRef.current?.getBoundingClientRect().height ?? 0;
    setDesktopLayout(
      computeDesktopPickerPosition({
        anchor: anchorDom,
        panelHeight: measuredHeight > 0 ? measuredHeight : DESKTOP_PICKER_ESTIMATED_HEIGHT_PX,
        viewportHeight: window.innerHeight,
      }),
    );
  }, [anchorRef]);

  React.useEffect(() => {
    if (
      prevDesktop.current !== null &&
      isDesktop !== null &&
      prevDesktop.current !== isDesktop &&
      open
    ) {
      onOpenChange(false);
    }
    prevDesktop.current = isDesktop;
  }, [isDesktop, open, onOpenChange]);

  React.useLayoutEffect(() => {
    if (!open || isDesktop !== true) {
      setDesktopLayout(null);
      return;
    }
    updateDesktopLayout();
  }, [open, isDesktop, updateDesktopLayout]);

  React.useEffect(() => {
    if (!open || isDesktop !== true) return;
    const panelEl = panelRef.current;
    if (!panelEl || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      updateDesktopLayout();
    });
    observer.observe(panelEl);
    return () => observer.disconnect();
  }, [open, isDesktop, updateDesktopLayout]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, onOpenChange, anchorRef]);

  React.useEffect(() => {
    if (!open || isDesktop !== true) return;
    const update = () => updateDesktopLayout();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, isDesktop, updateDesktopLayout]);

  const triggerNode =
    isDesktop === null
      ? React.cloneElement(trigger, { disabled: true, "aria-busy": true })
      : trigger;

  const overlay =
    open && isDesktop !== null && typeof document !== "undefined"
      ? createPortal(
          <>
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              className={cn("fixed inset-0 bg-black/40", overlayZClass)}
              onClick={() => onOpenChange(false)}
            />
            {isDesktop ? (
              <div
                ref={panelRef}
                // biome-ignore lint/a11y/useSemanticElements: fixed popover panel; native dialog modal breaks anchor positioning
                role="dialog"
                aria-modal="true"
                data-placement={desktopLayout?.placement ?? "below"}
                className={cn(
                  "fixed overflow-y-auto overscroll-contain rounded-md border bg-popover text-popover-foreground shadow-md outline-hidden",
                  desktopLayout?.placement === "above" ? "origin-bottom" : "origin-top",
                  overlayZClass,
                  popoverContentClassName,
                )}
                style={
                  desktopLayout
                    ? {
                        left: desktopLayout.left,
                        width: desktopLayout.width,
                        maxHeight: desktopLayout.maxHeight,
                        ...(desktopLayout.placement === "below"
                          ? { top: desktopLayout.top, bottom: "auto" }
                          : { top: "auto", bottom: desktopLayout.bottom }),
                      }
                    : { visibility: "hidden" as const }
                }
              >
                {panel}
                {footer ? (
                  <div className="border-t border-outline-variant/25 p-3 pt-0">{footer}</div>
                ) : null}
              </div>
            ) : (
              <div
                ref={panelRef}
                // biome-ignore lint/a11y/useSemanticElements: bottom sheet panel in portal; not a native modal dialog
                role="dialog"
                aria-modal="true"
                aria-label={sheetTitle}
                className={cn(
                  "fixed inset-x-0 bottom-0 flex max-h-[min(92dvh,720px)] flex-col rounded-t-2xl border-t border-outline-variant/20 bg-surface-container-lowest shadow-lg outline-none",
                  overlayZClass,
                )}
              >
                <div className="flex shrink-0 items-center justify-end px-3 pb-2 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="inline-flex size-11 items-center justify-center rounded-full p-0"
                    aria-label="Close"
                    onClick={() => onOpenChange(false)}
                  >
                    <X className="size-5" aria-hidden />
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{panel}</div>
                {footer ? (
                  <div className="shrink-0 border-t border-outline-variant/25 p-3">{footer}</div>
                ) : null}
              </div>
            )}
          </>,
          document.body,
        )
      : null;

  return (
    <>
      {triggerNode}
      {overlay}
    </>
  );
}

export { DetachedPickerShell };
