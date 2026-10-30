import type { LinkComponent } from "@auction/ui/lax";
import { formatCount } from "@auction/ui/lax/helpers";
import { ChevronRight, CircleCheck } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/cn.js";
import type { StaffStatusTone } from "../tokens.js";

export type AttentionItem = {
  id: string;
  /** What is waiting, without the number: "orders paid over 48 hours ago, not packed". */
  label: string;
  /** How many; a queue with nothing in it is not shown. */
  count: number;
  /** The list filtered to exactly these records. */
  href: string;
  /** How long the oldest has waited: "oldest 2 days". */
  oldest?: string;
  /** `warning` or `danger` for queues past their target; neutral otherwise. */
  tone?: Extract<StaffStatusTone, "neutral" | "warning" | "danger">;
  /**
   * Keep the item at a count of 0, for figures where nothing left is the problem (an open
   * edition with no prints on sale), not a cleared queue.
   */
  keepWhenZero?: boolean;
};

const countTone = {
  neutral: "bg-staff-neutral-bg text-staff-neutral-fg",
  warning: "bg-staff-warning-bg text-staff-warning-fg",
  danger: "bg-staff-danger-bg text-staff-danger-fg",
} as const;

/**
 * The top of an Overview page: the queues that need someone, most urgent first, each a link to
 * the list filtered to exactly that count. Empty queues drop out; when every queue is clear the
 * card says so instead of showing zeros.
 */
export function AttentionList({
  items,
  Link,
  title = "Needs attention",
  allClear = "Nothing needs you right now.",
  className,
}: {
  items: readonly AttentionItem[];
  Link: LinkComponent;
  title?: string;
  allClear?: React.ReactNode;
  className?: string;
}) {
  const waiting = items.filter((item) => item.count > 0 || item.keepWhenZero);
  return (
    <section
      aria-label={title}
      className={cn("rounded-staff-lg border border-staff-line bg-staff-surface", className)}
    >
      <h2 className="border-b border-staff-line-subtle px-4 py-3 font-staff text-staff-md font-semibold text-staff-fg">
        {title}
      </h2>
      {waiting.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-4 text-staff-sm text-staff-muted">
          <CircleCheck aria-hidden className="size-4 text-staff-success-dot" />
          {allClear}
        </p>
      ) : (
        <ul className="divide-y divide-staff-line-subtle">
          {waiting.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="staff-focus-inset group flex min-h-11 items-center gap-3 px-4 py-2.5 text-staff-sm transition-colors hover:staff-overlay-hover"
              >
                <span
                  className={cn(
                    "inline-flex h-6 min-w-8 shrink-0 items-center justify-center rounded-staff-xs px-1.5 font-medium tabular-nums",
                    countTone[item.tone ?? "neutral"],
                  )}
                >
                  {formatCount(item.count)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                  <span className="text-staff-fg">{item.label}</span>
                  {item.oldest ? (
                    <span className="shrink-0 text-staff-xs text-staff-muted">{item.oldest}</span>
                  ) : null}
                </span>
                <ChevronRight
                  aria-hidden
                  className="size-4 shrink-0 text-staff-subtle transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
