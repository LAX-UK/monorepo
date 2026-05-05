"use client";

import { Toaster as SonnerToaster } from "sonner";
import type { ToasterProps } from "sonner";
import { cn } from "../../lib/utils.js";

/**
 * Shared Sonner host for apps — design tokens + LAX defaults (position, duration, safe-area).
 * Pass `theme` from the app shell (e.g. sync with `<html class="dark">`).
 */
export function Toaster({
  className,
  toastOptions,
  theme,
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
      {...rest}
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast: cn(
            "group toast font-body group-[.toaster]:bg-surface-container-highest group-[.toaster]:text-on-surface group-[.toaster]:border-outline-variant/20 group-[.toaster]:shadow-lg",
            u?.toast,
          ),
          title: cn("font-label text-xs uppercase tracking-widest", u?.title),
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
