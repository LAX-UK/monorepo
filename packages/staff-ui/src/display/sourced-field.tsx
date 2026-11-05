import { Lock } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/cn.js";

/**
 * The mark on a value another system owns: a lock and the system's name ("From Zoho"). It says
 * why the value is not an input; the words carry the meaning, the lock only repeats it.
 */
export function SourceMark({ source, className }: { source: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-staff-xs font-medium text-staff-muted",
        className,
      )}
    >
      <Lock aria-hidden className="size-3" />
      {source}
    </span>
  );
}

export type SourcedFieldProps = {
  label: string;
  /** Who owns the value: "From Zoho". */
  source: string;
  /** The value, as text or a node. Leave empty (null) when the owner has no value yet. */
  children?: React.ReactNode;
  /** Shown instead of a value the owner does not hold: "Not in Zoho yet". */
  emptyText?: string;
  className?: string;
};

/**
 * A read-only field whose value comes from another system: label and source mark on one line, the
 * value below in the same box an input would have, on the sunken surface and at full text
 * contrast. Staff change it where it comes from, so it takes no focus and has no edit control.
 */
export function SourcedField({
  label,
  source,
  children,
  emptyText = "Not set yet",
  className,
}: SourcedFieldProps) {
  const empty = children === null || children === undefined || children === "";
  return (
    <dl className={cn("flex flex-col gap-1.5", className)}>
      <dt className="flex items-center gap-2">
        <span className="text-staff-sm font-medium text-staff-fg">{label}</span>
        <SourceMark source={source} className="ml-auto" />
      </dt>
      <dd
        className={cn(
          "m-0 flex min-h-control-md items-center rounded-staff-sm border border-staff-line bg-staff-sunken px-2.5 text-staff-sm",
          empty ? "text-staff-muted" : "text-staff-fg",
        )}
      >
        {empty ? emptyText : children}
      </dd>
    </dl>
  );
}
