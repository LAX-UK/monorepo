import { type LinkComponent, StatusBadge } from "@auction/ui/lax";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/cn.js";
import { StaffButtonLink } from "../primitives/button-link.js";
import { StaffButton } from "../primitives/button.js";

export type IssueItem = {
  id: string;
  /** What is wrong, as a sentence: "Two lots have no photos". */
  label: string;
  /** How serious: danger blocks the record, warning should be fixed, neutral is a note. */
  tone?: "neutral" | "warning" | "danger";
  /** The area it belongs to, as a short tag: "Setup", "Payments". */
  tag?: string;
  /** Where to fix it. */
  action?: { label: string; href: string };
};

const toneIcon = {
  neutral: { Icon: Info, className: "text-staff-muted" },
  warning: { Icon: TriangleAlert, className: "text-staff-warning-dot" },
  danger: { Icon: CircleAlert, className: "text-staff-danger" },
} as const;

const tagTone = { neutral: "neutral", warning: "warning", danger: "danger" } as const;

/**
 * The problems on one record, most serious first: one row each with its icon, a short tag and a
 * link to where it is fixed. Unlike `AttentionList` (queues of many records), each row is one
 * thing to do here. With nothing open it says so, or renders nothing when `allClear` is null.
 */
export function IssueList({
  items,
  Link,
  title = "Needs attention",
  allClear = "Nothing needs attention.",
  onDismissAll,
  className,
}: {
  items: readonly IssueItem[];
  Link: LinkComponent;
  title?: string;
  allClear?: React.ReactNode | null;
  /** Hides the advisory rows for this person; leave out when they cannot be dismissed. */
  onDismissAll?: () => void;
  className?: string;
}) {
  if (items.length === 0 && allClear === null) return null;
  const rank = { danger: 0, warning: 1, neutral: 2 } as const;
  const ordered = [...items].sort((a, b) => rank[a.tone ?? "neutral"] - rank[b.tone ?? "neutral"]);
  return (
    <section
      aria-label={title}
      className={cn("rounded-staff-lg border border-staff-line bg-staff-surface", className)}
    >
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-staff-line-subtle px-4 py-2">
        <h2 className="font-staff text-staff-md font-semibold text-staff-fg">{title}</h2>
        {onDismissAll && ordered.length > 0 ? (
          <StaffButton size="sm" variant="ghost" onClick={onDismissAll}>
            Dismiss all
          </StaffButton>
        ) : null}
      </header>
      {ordered.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-4 text-staff-sm text-staff-muted">
          <CircleCheck aria-hidden className="size-4 text-staff-success-dot" />
          {allClear}
        </p>
      ) : (
        <ul className="divide-y divide-staff-line-subtle">
          {ordered.map((item) => {
            const tone = item.tone ?? "neutral";
            const { Icon, className: iconClass } = toneIcon[tone];
            return (
              <li key={item.id} className="flex min-h-11 items-center gap-3 px-4 py-2">
                <Icon aria-hidden className={cn("size-4 shrink-0", iconClass)} />
                <span className="min-w-0 flex-1 text-staff-sm text-staff-fg">{item.label}</span>
                {item.tag ? <StatusBadge tone={tagTone[tone]}>{item.tag}</StatusBadge> : null}
                {item.action ? (
                  <StaffButtonLink size="sm" variant="ghost" href={item.action.href} Link={Link}>
                    {item.action.label}
                  </StaffButtonLink>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
