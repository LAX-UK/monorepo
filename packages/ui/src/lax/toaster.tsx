"use client";

import { Toaster as BaseToaster } from "../components/ui/sonner.js";
import { cn } from "../lib/utils.js";
import type { LaxDensity } from "./density.js";

/** A plain confirmation stays 5s; one with Undo stays 10s, and both pause while hovered. */
export const TOAST_DURATION_MS = 5000;
export const UNDO_TOAST_DURATION_MS = 10_000;

const TEXT_STEP: Record<LaxDensity, string> = { staff: "text-lax-13", client: "text-lax-14" };

/**
 * Feedback after an action, bottom right on desktop, above the thumb on a phone. A raised surface
 * with a hairline, 8px radius and shadow md; a sentence-case title, one optional line and at most
 * one ink action (Undo). Success and failure carry an icon, never a colour fill, and a failure the
 * person must act on belongs on the page, not in a toast.
 *
 * The toaster renders at the end of `<body>`, outside the shell, so it takes the density as a
 * prop. `mobileOffset` lifts it above a phone's bottom tab bar.
 */
export function Toaster({
  density = "staff",
  mobileOffset,
}: {
  density?: LaxDensity;
  mobileOffset?: number | string;
}) {
  const text = TEXT_STEP[density];
  return (
    <BaseToaster
      position="bottom-right"
      richColors={false}
      closeButton
      duration={TOAST_DURATION_MS}
      offset={24}
      {...(mobileOffset === undefined ? {} : { mobileOffset })}
      toastOptions={{
        classNames: {
          toast:
            "font-lax rounded-lax-menu! border! border-lax-line! bg-lax-raised! text-lax-fg! shadow-lax-md!",
          title: cn("font-lax font-medium normal-case tracking-normal", text),
          description: cn("font-lax text-lax-muted!", text),
          actionButton:
            "group-[.toast]:rounded-lax-control group-[.toast]:bg-lax-ink group-[.toast]:text-lax-on-ink",
          // Sonner's own close button is 20px; targets are at least 24px.
          closeButton:
            "size-6! border-lax-line! bg-lax-raised! text-lax-muted! hover:text-lax-fg! lax-focus",
          cancelButton:
            "group-[.toast]:rounded-lax-control group-[.toast]:bg-lax-sunken group-[.toast]:text-lax-fg",
          success: "[&_[data-icon]]:text-lax-success-dot",
          error: "[&_[data-icon]]:text-lax-danger-dot",
        },
      }}
    />
  );
}
