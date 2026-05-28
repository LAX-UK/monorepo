"use client";

import { LabelCaps } from "@auction/ui";
import type { ReactNode } from "react";

export type DashboardFilterSectionProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

/** Labelled fieldset wrapper for filter sheet groups. */
export function DashboardFilterSection({
  label,
  children,
  className,
}: DashboardFilterSectionProps) {
  return (
    <fieldset className={className ?? "space-y-3 border-0 p-0"}>
      <LabelCaps className="mb-2 block text-on-surface-variant">{label}</LabelCaps>
      {children}
    </fieldset>
  );
}
