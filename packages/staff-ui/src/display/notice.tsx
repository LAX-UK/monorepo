import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/cn.js";

const toneClass = {
  info: { box: "border-staff-info-dot/30 bg-staff-info-bg text-staff-info-fg", Icon: Info },
  warning: {
    box: "border-staff-warning-dot/35 bg-staff-warning-bg text-staff-warning-fg",
    Icon: TriangleAlert,
  },
  danger: {
    box: "border-staff-danger/30 bg-staff-danger-bg text-staff-danger-fg",
    Icon: CircleAlert,
  },
} as const;

/**
 * A short message about the page or record, above the work it concerns: why something cannot be
 * done yet, or that the record changed elsewhere. One line of title, an optional line of detail
 * and at most one or two actions on the right. `role="status"` unless `alert` is set.
 */
export function Notice({
  tone = "info",
  title,
  children,
  actions,
  alert = false,
  className,
}: {
  tone?: keyof typeof toneClass;
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  /** Announce immediately (a failure the person must act on). */
  alert?: boolean;
  className?: string;
}) {
  const { box, Icon } = toneClass[tone];
  return (
    <div
      role={alert ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-3 rounded-staff-md border px-3 py-2.5 text-staff-sm sm:flex-row sm:items-center",
        box,
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 gap-2.5">
        <Icon aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          {children ? <div className="mt-0.5 opacity-90">{children}</div> : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">{actions}</div>
      ) : null}
    </div>
  );
}
