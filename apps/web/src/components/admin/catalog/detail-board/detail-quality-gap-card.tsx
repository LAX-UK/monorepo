import type { DetailQualityGapRow } from "@/lib/admin/detail-board/types";
import { cn } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { AlertTriangle } from "lucide-react";

const SEVERITY_LABEL: Record<DetailQualityGapRow["severity"], string> = {
  required: "Required",
  warning: "Advisory",
};

const SEVERITY_VARIANT: Record<
  DetailQualityGapRow["severity"],
  "destructive" | "secondary" | "outline"
> = {
  required: "destructive",
  warning: "secondary",
};

export type DetailQualityGapCardProps = {
  rows: readonly DetailQualityGapRow[];
  title?: string;
  emptyMessage?: string;
  className?: string;
};

/** Field-level quality gap callouts (submission review, catalogue checks). */
export function DetailQualityGapCard({
  rows,
  title = "Quality gap",
  emptyMessage,
  className,
}: DetailQualityGapCardProps) {
  if (rows.length === 0 && emptyMessage) {
    return <p className="font-body text-sm text-on-surface-variant">{emptyMessage}</p>;
  }
  if (rows.length === 0) return null;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-shell-card border border-shell-stroke bg-surface-container-lowest shadow-[var(--shadow-rest)]",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-shell-stroke px-4 py-4 sm:px-6">
        <h2 className="font-headline text-base font-semibold text-on-surface">{title}</h2>
        <Badge
          variant="secondary"
          className="h-6 min-w-6 rounded-full bg-on-surface px-2 font-label text-xs font-semibold text-surface-container-lowest"
        >
          {rows.length}
        </Badge>
      </div>
      <ul className="divide-y divide-shell-stroke/60 px-4 py-2 sm:px-6">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start gap-3 py-3">
            <span
              className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-warning-container text-warning"
              aria-hidden
            >
              <AlertTriangle className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-headline text-sm font-medium text-on-surface">{row.field}</p>
                <Badge
                  variant={SEVERITY_VARIANT[row.severity]}
                  className="font-label text-[10px] uppercase"
                >
                  {SEVERITY_LABEL[row.severity]}
                </Badge>
              </div>
              <p className="mt-1 font-body text-sm text-on-surface-variant">{row.message}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
