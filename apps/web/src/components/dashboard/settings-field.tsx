import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type SettingsFieldProps = {
  label: string;
  /** Main value line */
  value: ReactNode;
  /** Optional row beside value (e.g. verified badge) */
  valueAccessory?: ReactNode;
  /** Link or button on the label row (e.g. Edit) */
  action?: ReactNode;
  className?: string;
};

/** Label / value stack with optional edit affordance (mockup-style). */
export function SettingsField({
  label,
  value,
  valueAccessory,
  action,
  className,
}: SettingsFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex min-h-6 items-center justify-between gap-3">
        <span className="font-label text-[13px] font-normal uppercase tracking-wide text-on-surface-variant">
          {label}
        </span>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 font-body text-base leading-6 text-on-surface">{value}</div>
        {valueAccessory}
      </div>
    </div>
  );
}
