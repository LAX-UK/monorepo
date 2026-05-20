"use client";

import { EditableCell } from "@/components/admin/editable-cell";
import type { ActionResult } from "@/lib/forms/form-result";
import { cn } from "@auction/ui";

type Props = {
  value: string;
  onSave: (next: string) => Promise<ActionResult<void>>;
  className?: string;
  as?: "h1" | "span";
};

/** Inline-editable title — default `span` because `DashboardDetailHeader` / `DashboardPageHeader` own the outer `<h1>`. */
export function AdminEditableTitle({ value, onSave, className, as = "span" }: Props) {
  const Tag = as;
  const isStandaloneHeading = as === "h1";
  return (
    <Tag
      className={cn(
        isStandaloneHeading && "font-headline text-2xl font-semibold text-on-surface sm:text-3xl",
        className,
      )}
    >
      <EditableCell
        value={value}
        onSave={onSave}
        ariaLabel="Title"
        className={cn(isStandaloneHeading && "font-headline text-2xl font-semibold sm:text-3xl")}
        inputClassName={cn(isStandaloneHeading && "font-headline text-xl sm:text-2xl")}
      />
    </Tag>
  );
}
