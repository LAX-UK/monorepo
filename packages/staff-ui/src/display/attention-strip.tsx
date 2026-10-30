import type { LinkComponent } from "@auction/ui/lax";
import { ArrowRight, CircleAlert, Info, TriangleAlert } from "lucide-react";
import { cn } from "../lib/cn.js";

export type AttentionStripItem = {
  id: string;
  /** How many records wait; an issue with nothing waiting is not shown. */
  count: number;
  /** The rest of the sentence after the count: "payments need manual review". */
  label: string;
  /** The list filtered to exactly these records. */
  href: string;
  /** The link's verb: "Review", "Resolve". Defaults to "Review". */
  actionLabel?: string;
  /** `warning` or `danger` once the issue is past its target; neutral otherwise. */
  tone?: "neutral" | "warning" | "danger";
};

const COUNT = new Intl.NumberFormat("en-GB");

const tone = {
  neutral: { Icon: Info, className: "text-staff-muted" },
  warning: { Icon: TriangleAlert, className: "text-staff-warning-dot" },
  danger: { Icon: CircleAlert, className: "text-staff-danger" },
} as const;

/**
 * The work waiting on a list, above it: one compact line per issue, "10 payments need manual
 * review · Review", each linking to the filtered view. Work cannot be dismissed, only done, so
 * there is no Dismiss; an issue with a zero count drops out and an empty strip renders nothing.
 */
export function AttentionStrip({
  items,
  Link,
  label = "Needs attention",
  className,
}: {
  items: readonly AttentionStripItem[];
  Link: LinkComponent;
  label?: string;
  className?: string;
}) {
  const waiting = items.filter((item) => item.count > 0);
  if (waiting.length === 0) return null;
  return (
    <section
      aria-label={label}
      className={cn(
        "overflow-hidden rounded-staff-lg border border-staff-line bg-staff-surface text-staff-sm",
        className,
      )}
    >
      <ul className="divide-y divide-staff-line-subtle">
        {waiting.map((item) => {
          const { Icon, className: iconClass } = tone[item.tone ?? "neutral"];
          const action = item.actionLabel ?? "Review";
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className="staff-focus-inset group flex min-h-10 items-center gap-2.5 px-4 py-2 transition-colors hover:staff-overlay-hover"
              >
                <Icon aria-hidden className={cn("size-4 shrink-0", iconClass)} strokeWidth={1.75} />
                <span className="min-w-0 flex-1 text-staff-fg">
                  <span className="font-semibold tabular-nums">
                    {item.count > 999 ? "999+" : COUNT.format(item.count)}
                  </span>{" "}
                  {item.label}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 font-medium text-staff-fg">
                  {action}
                  <ArrowRight
                    aria-hidden
                    className="size-3.5 text-staff-muted transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
