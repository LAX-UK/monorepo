"use client";

import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type AdminFilterSectionProps = {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

/** Section heading — stronger than field labels; groups related drawer controls. */
export const adminFilterSectionLegendClassName = "font-label text-sm font-semibold text-on-surface";

/** Field label — lighter caps style for individual inputs. */
export const adminFilterFieldLabelClassName =
  "font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";

export const adminFilterControlClassName =
  "h-10 w-full font-body text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Boxed field surface — matches design-system `fieldVariantBoxed`. */
export const adminFilterControlSurfaceClassName =
  "rounded-md border border-outline-variant/25 bg-surface-container-lowest shadow-sm";

/** Vertical stack between label and control inside a field row. */
export const adminFilterFieldStackClassName = "flex w-full flex-col gap-2";

/** Drawer body rhythm — consistent vertical gap between field groups. */
export const adminFilterSheetContentClassName = "flex flex-col gap-6";

/** Groups drawer filter fields with consistent vertical rhythm. */
export function AdminFilterSheetFields({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(adminFilterSheetContentClassName, className)}>{children}</div>;
}

/** Labelled fieldset for admin filter drawers. */
export function AdminFilterSection({
  label,
  description,
  children,
  className,
}: AdminFilterSectionProps) {
  return (
    <fieldset className={cn("space-y-2 border-0 p-0", className)}>
      <legend className={cn("mb-0 block w-full", adminFilterSectionLegendClassName)}>
        {label}
      </legend>
      {description ? (
        <p className="font-body text-sm text-on-surface-variant">{description}</p>
      ) : null}
      <div className="space-y-2">{children}</div>
    </fieldset>
  );
}
