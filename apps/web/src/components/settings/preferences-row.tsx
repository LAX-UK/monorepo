import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type PreferencesRowProps = {
  id: string;
  label: string;
  description?: string;
  control: ReactNode;
  className?: string;
};

/** iOS-style settings row: label left, control right, optional helper below. */
export function PreferencesRow({
  id,
  label,
  description,
  control,
  className,
}: PreferencesRowProps) {
  return (
    <div
      className={cn(
        "flex min-h-14 flex-col gap-1 border-b border-outline-variant/15 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <label
          htmlFor={id}
          className="block font-body text-sm font-medium leading-snug text-on-surface"
        >
          {label}
        </label>
        {description ? (
          <p id={`${id}-hint`} className="mt-0.5 text-[13px] leading-snug text-on-surface-variant">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center justify-end sm:pl-4">{control}</div>
    </div>
  );
}

export function PreferencesSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-lowest",
        className,
      )}
    >
      <h2 className="border-b border-outline-variant/15 bg-surface-container-low/40 px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
        {title}
      </h2>
      <div className="divide-y divide-outline-variant/10">{children}</div>
    </section>
  );
}
