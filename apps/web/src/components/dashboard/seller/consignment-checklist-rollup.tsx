import type { ChecklistRollupRowView } from "@/lib/seller/consignment-checklist-rollup-view";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { Circle, Clock } from "lucide-react";
import Link from "next/link";

type Props = {
  rows: readonly ChecklistRollupRowView[];
};

/**
 * The open checklist items across every consignment, on the Selling overview. Nothing is shown
 * when everything is done: the consignments say so themselves.
 */
export function ConsignmentChecklistRollup({ rows }: Props) {
  if (rows.length === 0) return null;
  const firstAction = rows.findIndex((row) => row.action);
  return (
    <section aria-labelledby="checklist-rollup-heading" className="space-y-3 pt-4">
      <h2
        id="checklist-rollup-heading"
        className="font-headline text-lg font-semibold tracking-tight text-on-surface"
      >
        Before your works can go to sale
      </h2>
      <Surface variant="section" padding="none" className="overflow-hidden p-0 sm:p-0">
        <ul className="divide-y divide-border-hairline">
          {rows.map((row, index) => (
            <li
              key={`${row.id}:${row.state}`}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
              data-testid={`rollup-${row.id}`}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {row.state === "waiting" ? (
                  <Clock className="mt-0.5 size-5 shrink-0 text-on-surface-variant" aria-hidden />
                ) : (
                  <Circle className="mt-0.5 size-5 shrink-0 text-outline-variant" aria-hidden />
                )}
                <div className="min-w-0 space-y-0.5">
                  <p className="font-body text-sm font-semibold text-on-surface">{row.title}</p>
                  <p className="truncate font-body text-sm text-on-surface-variant">
                    {row.concerns}
                  </p>
                  <p className="font-body text-xs text-on-surface-variant">
                    {row.waiting ?? row.due}
                  </p>
                </div>
              </div>
              {row.action ? (
                <Button
                  asChild
                  size="sm"
                  variant={index === firstAction ? "primary" : "outline"}
                  className="ml-8 self-start sm:ml-0 sm:self-center"
                >
                  <Link href={row.action.href}>{row.action.label}</Link>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Surface>
    </section>
  );
}
