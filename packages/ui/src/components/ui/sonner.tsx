"use client";

import type { CSSProperties } from "react";
import { Toaster as SonnerToaster } from "sonner";
import type { ToasterProps } from "sonner";
import { cn } from "../../lib/utils.js";

/**
 * The success toast's colours, from the same tokens as the success status badge. Sonner's own
 * rich-colour green fails 4.5:1 for its text on light pages; these pairs are set by every product
 * theme to pass in light and dark. Set on the toaster element, they override Sonner's defaults.
 */
export const TOAST_SUCCESS_COLOURS: Readonly<Record<string, string>> = {
  "--success-bg": "var(--color-success-container)",
  "--success-text": "var(--color-on-success-container)",
  "--success-border": "color-mix(in srgb, var(--color-on-success-container) 20%, transparent)",
};

/** Shared Sonner host for apps — design tokens + LAX defaults (position, duration, safe-area).
 * Pass `theme` from the app shell (e.g. sync with `<html class="dark">`).
 */
export function Toaster({
  className,
  toastOptions,
  theme,
  style,
  position = "top-center",
  duration = 6000,
  visibleToasts = 3,
  closeButton = true,
  richColors = true,
  offset = "max(12px, env(safe-area-inset-top))",
  mobileOffset = "max(5rem, env(safe-area-inset-bottom))",
  ...rest
}: ToasterProps) {
  const u = toastOptions?.classNames;

  return (
    <SonnerToaster
      theme={theme ?? "light"}
      position={position}
      duration={duration}
      visibleToasts={visibleToasts}
      closeButton={closeButton}
      richColors={richColors}
      offset={offset}
      mobileOffset={mobileOffset}
      className={cn("toaster group", className)}
      style={{ ...TOAST_SUCCESS_COLOURS, ...style } as CSSProperties}
      {...rest}
      toastOptions={{
        ...toastOptions,
        // Callers' other slots (close button, per-type icons) pass through; the defaults below
        // only add to the slots this wrapper styles.
        classNames: {
          ...u,
          toast: cn(
            "group toast font-body group-[.toaster]:bg-surface-container-highest group-[.toaster]:text-on-surface group-[.toaster]:border-outline-variant/20 group-[.toaster]:shadow-lg",
            u?.toast,
          ),
          title: cn("font-body text-sm font-medium normal-case tracking-normal", u?.title),
          description: cn(
            "font-body text-sm group-[.toast]:text-on-surface-variant",
            u?.description,
          ),
          actionButton: cn(
            "group-[.toast]:bg-primary group-[.toast]:text-on-primary",
            u?.actionButton,
          ),
          cancelButton: cn(
            "group-[.toast]:bg-surface-container-high group-[.toast]:text-on-surface",
            u?.cancelButton,
          ),
        },
      }}
    />
  );
}
