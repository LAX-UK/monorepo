"use client";

import { Toaster } from "@auction/ui/components/sonner";

/**
 * Feedback after an action, bottom right on desktop, above the thumb on a phone. Sentence-case
 * title, one optional line, raised surface; success and failure carry an icon, not a colour fill.
 */
export function StaffToaster() {
  return (
    <Toaster
      position="bottom-right"
      richColors={false}
      closeButton
      duration={5000}
      offset={24}
      toastOptions={{
        classNames: {
          toast:
            "font-staff group-[.toaster]:rounded-staff-md group-[.toaster]:border group-[.toaster]:border-staff-line group-[.toaster]:bg-staff-raised group-[.toaster]:text-staff-fg group-[.toaster]:shadow-staff-md",
          title: "font-staff text-staff-sm font-medium normal-case tracking-normal",
          description: "font-staff text-staff-sm group-[.toast]:text-staff-muted",
          actionButton:
            "group-[.toast]:rounded-staff-sm group-[.toast]:bg-staff-ink group-[.toast]:text-staff-on-ink",
          cancelButton:
            "group-[.toast]:rounded-staff-sm group-[.toast]:bg-staff-sunken group-[.toast]:text-staff-fg",
          success: "[&_[data-icon]]:text-staff-success-dot",
          error: "[&_[data-icon]]:text-staff-danger-dot",
        },
      }}
    />
  );
}
