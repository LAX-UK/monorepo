"use client";

import { Toaster as SonnerToaster } from "sonner";
import type { ToasterProps } from "sonner";
import { cn } from "../../lib/utils.js";

export function Toaster({ className, ...props }: ToasterProps) {
  return (
    <SonnerToaster
      className={cn("toaster group", className)}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface-container-highest group-[.toaster]:text-on-surface group-[.toaster]:border-outline-variant/20 group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-on-surface-variant",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-on-primary",
          cancelButton: "group-[.toast]:bg-surface-container-high group-[.toast]:text-on-surface",
        },
      }}
      {...props}
    />
  );
}
