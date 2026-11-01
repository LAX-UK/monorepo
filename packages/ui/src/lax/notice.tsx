import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils.js";

/**
 * Tone per concern. Staff notices are tinted throughout, with a tinted edge. In the client
 * workspace information is calm (the surface with a hairline and a blue icon), while success, a
 * warning or a block keeps its tint without an edge, so the notices that ask for action stand out.
 */
const toneClass = {
  info: {
    box: "border-lax-info-dot/30 bg-lax-info-bg text-lax-info-fg in-data-[lax-density=client]:border-lax-line in-data-[lax-density=client]:bg-lax-surface in-data-[lax-density=client]:text-lax-fg",
    icon: "in-data-[lax-density=client]:text-lax-info-dot",
    Icon: Info,
  },
  success: {
    box: "border-lax-success-dot/30 bg-lax-success-bg text-lax-success-fg in-data-[lax-density=client]:border-transparent",
    icon: "",
    Icon: CircleCheck,
  },
  warning: {
    box: "border-lax-warning-dot/35 bg-lax-warning-bg text-lax-warning-fg in-data-[lax-density=client]:border-transparent",
    icon: "",
    Icon: TriangleAlert,
  },
  danger: {
    box: "border-lax-danger/30 bg-lax-danger-bg text-lax-danger-fg in-data-[lax-density=client]:border-transparent",
    icon: "",
    Icon: CircleAlert,
  },
} as const;

export type NoticeTone = keyof typeof toneClass;

/**
 * A short message about the page or record, above the work it concerns: why something cannot be
 * done yet, or that the record changed elsewhere. One line of title, an optional line of detail
 * and at most one or two actions on the right. `role="status"` unless `alert` is set. A 12px
 * block, like a card: dense for staff, 16px of padding and a 600 title for clients.
 */
export function Notice({
  tone = "info",
  title,
  children,
  actions,
  alert = false,
  className,
  ...rest
}: Omit<React.HTMLAttributes<HTMLDivElement>, "title" | "role" | "children"> & {
  tone?: NoticeTone;
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  /** Announce immediately (a failure the person must act on). */
  alert?: boolean;
  className?: string;
}) {
  const { box, icon, Icon } = toneClass[tone];
  const titleId = React.useId();
  return (
    <div
      {...rest}
      role={alert ? "alert" : "status"}
      aria-labelledby={titleId}
      data-tone={tone}
      className={cn(
        "flex flex-col gap-3 rounded-lax-card border px-3 py-2.5 text-lax-ui sm:flex-row sm:items-center",
        "in-data-[lax-density=client]:p-4",
        box,
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 gap-2.5 in-data-[lax-density=client]:gap-3">
        <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", icon)} strokeWidth={1.75} />
        <div className="min-w-0">
          <p id={titleId} className="font-medium in-data-[lax-density=client]:font-semibold">
            {title}
          </p>
          {children ? <div className="mt-0.5 opacity-90">{children}</div> : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0 in-data-[lax-density=client]:pl-7 sm:in-data-[lax-density=client]:pl-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
