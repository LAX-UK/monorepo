import type { LinkComponent } from "@auction/ui/lax";
import { Check, Circle, CircleAlert, X } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";

export type ChecklistItem = {
  id: string;
  /** What has to be true, as a short sentence: "Add at least one photo". */
  label: string;
  done: boolean;
  /** Required items block the next step; recommended ones should be done but do not. */
  severity?: "required" | "recommended";
  /** Where to do it. */
  href?: string;
};

function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  const percent = total === 0 ? 100 : Math.round((done / total) * 100);
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: a progress bar is read-only status, not a control.
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-valuetext={`${done} of ${total} done`}
      className="h-1.5 w-full overflow-hidden rounded-full bg-staff-sunken"
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-200 ease-out",
          done === total ? "bg-staff-success-dot" : "bg-staff-fg",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function ItemIcon({ item }: { item: ChecklistItem }) {
  if (item.done) {
    return (
      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-staff-success-dot">
        <Check aria-hidden className="size-3 text-staff-surface" strokeWidth={3} />
      </span>
    );
  }
  if (item.severity === "required") {
    return <CircleAlert aria-hidden className="size-4 shrink-0 text-staff-danger" />;
  }
  return <Circle aria-hidden className="size-4 shrink-0 text-staff-warning-dot" />;
}

/**
 * What has to be done before a record can move on (publish a lot, open a sale), with how much is
 * done. Each open item says whether it blocks, and links to where it is done; done items stay in
 * the list, read out as "Done". `compact` shows only the progress and
 * the first open item, for a card that has little room.
 */
export function Checklist({
  title,
  items,
  Link,
  description,
  compact = false,
  onDismiss,
  headingLevel = "h2",
  className,
}: {
  title: string;
  items: readonly ChecklistItem[];
  Link: LinkComponent;
  description?: React.ReactNode;
  compact?: boolean;
  /** Hides the checklist for this person; leave out when it must stay. */
  onDismiss?: () => void;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const done = items.filter((item) => item.done).length;
  const total = items.length;
  const firstOpen =
    items.find((item) => !item.done && item.severity === "required") ??
    items.find((item) => !item.done);
  const Heading = headingLevel;
  const summary = `${done} of ${total} done`;

  if (compact) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="flex items-center justify-between gap-3">
          <Heading className="text-staff-sm font-medium text-staff-fg">{title}</Heading>
          <span className="text-staff-xs tabular-nums text-staff-muted">{summary}</span>
        </div>
        <Progress done={done} total={total} label={title} />
        {firstOpen ? (
          <p className="flex items-center gap-2 text-staff-sm text-staff-fg">
            <ItemIcon item={firstOpen} />
            {firstOpen.href ? (
              <Link
                href={firstOpen.href}
                className="rounded-staff-sm underline decoration-staff-line-strong underline-offset-2 hover:decoration-staff-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-staff-focus"
              >
                {firstOpen.label}
              </Link>
            ) : (
              firstOpen.label
            )}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <section
      aria-label={title}
      className={cn("rounded-staff-lg border border-staff-line bg-staff-surface", className)}
    >
      <header className="flex flex-col gap-2.5 border-b border-staff-line-subtle px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Heading className="font-staff text-staff-md font-semibold text-staff-fg">
              {title}
            </Heading>
            {description ? <p className="text-staff-xs text-staff-muted">{description}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-staff-xs tabular-nums text-staff-muted">{summary}</span>
            {onDismiss ? (
              <StaffButton
                size="icon-sm"
                variant="ghost"
                aria-label={`Hide ${title.toLowerCase()}`}
                onClick={onDismiss}
              >
                <X aria-hidden />
              </StaffButton>
            ) : null}
          </div>
        </div>
        <Progress done={done} total={total} label={title} />
      </header>
      <ul className="divide-y divide-staff-line-subtle">
        {items.map((item) => (
          <li key={item.id} className="flex min-h-11 items-center gap-3 px-4 py-2">
            <ItemIcon item={item} />
            <span
              className={cn(
                "min-w-0 flex-1 text-staff-sm",
                item.done ? "text-staff-muted" : "text-staff-fg",
              )}
            >
              {item.label}
              <span className="sr-only">
                {item.done ? ". Done" : item.severity === "required" ? ". Required" : ". To do"}
              </span>
            </span>
            {!item.done && item.severity === "required" ? (
              <span aria-hidden className="text-staff-xs text-staff-danger">
                Required
              </span>
            ) : null}
            {!item.done && item.href ? (
              <StaffButton asChild size="sm" variant="ghost">
                <Link href={item.href}>Fix</Link>
              </StaffButton>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
