import type { ChecklistItemView } from "@/lib/seller/consignment-checklist-copy";
import { cn } from "@auction/ui";
import { Surface } from "@auction/ui/components/surface";
import { Button } from "@auction/ui/lax";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import Link from "next/link";

type Props = {
  items: readonly ChecklistItemView[];
  doneCount: number;
  totalCount: number;
};

function ItemIcon({ state }: { state: ChecklistItemView["state"] }) {
  if (state === "done") {
    return <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />;
  }
  if (state === "waiting") {
    return <Clock className="size-5 shrink-0 text-on-surface-variant" aria-hidden />;
  }
  return <Circle className="size-5 shrink-0 text-outline-variant" aria-hidden />;
}

const STATE_LABEL: Record<ChecklistItemView["state"], string> = {
  done: "Done",
  action: "To do",
  waiting: "Waiting",
  not_yet: "Not yet",
};

/**
 * "Before your work can go to sale": the three things a seller does after submitting, each with
 * why it is needed, by when, and one button when the person can do it now. Done items tick off;
 * items someone else must do say who.
 */
export function ConsignmentChecklist({ items, doneCount, totalCount }: Props) {
  const firstAction = items.find((item) => item.action)?.id;
  return (
    <section aria-labelledby="consignment-checklist-heading">
      <Surface variant="section" className="space-y-1 sm:space-y-2">
        <div className="space-y-1">
          <h2
            id="consignment-checklist-heading"
            className="font-headline text-lg font-semibold tracking-tight text-on-surface"
          >
            Before your work can go to sale
          </h2>
          <p className="font-body text-sm text-on-surface-variant">
            {doneCount} of {totalCount} done
          </p>
        </div>
        <ul className="divide-y divide-border-hairline">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 py-4 last:pb-0 sm:flex-row sm:items-center sm:gap-4"
              data-testid={`checklist-${item.id}`}
              data-state={item.state}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <ItemIcon state={item.state} />
                <div className="min-w-0 space-y-0.5">
                  <p
                    className={cn(
                      "font-body text-sm font-semibold",
                      item.state === "done" ? "text-on-surface-variant" : "text-on-surface",
                    )}
                  >
                    {item.title}
                    <span className="sr-only">: {STATE_LABEL[item.state]}</span>
                  </p>
                  {item.state === "done" ? null : (
                    <p className="font-body text-sm text-on-surface-variant">{item.why}</p>
                  )}
                  <p className="font-body text-xs text-on-surface-variant">
                    {item.waiting ?? item.due}
                  </p>
                </div>
              </div>
              {item.action ? (
                <Button
                  asChild
                  size="md"
                  variant={item.id === firstAction ? "primary" : "secondary"}
                  className="ml-8 self-start sm:ml-0 sm:self-center"
                >
                  <Link href={item.action.href}>{item.action.label}</Link>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Surface>
    </section>
  );
}
