import type {
  DetailAttentionIconKind,
  DetailAttentionRow,
  DetailAttentionSeverity,
} from "@/lib/admin/detail-board/types";
import { cn } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import {
  AlertTriangle,
  CreditCard,
  Gavel,
  type LucideIcon,
  Package,
  Phone,
  Settings,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";

const SEVERITY_LABEL: Record<DetailAttentionSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const SEVERITY_VARIANT: Record<
  DetailAttentionSeverity,
  "destructive" | "secondary" | "outline" | "default"
> = {
  critical: "destructive",
  high: "secondary",
  medium: "outline",
  low: "outline",
};

const ICON_BY_KIND: Record<DetailAttentionIconKind, LucideIcon> = {
  setup: Settings,
  registrations: Users,
  catalog: Package,
  finance: CreditCard,
  saleroom: Gavel,
  telephone: Phone,
  delete: Trash2,
  general: AlertTriangle,
};

function AttentionRowIcon({ kind = "general" }: { kind?: DetailAttentionIconKind }) {
  const Icon = ICON_BY_KIND[kind];
  return (
    <span
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high font-label text-xs font-semibold text-on-surface"
      aria-hidden
    >
      <Icon className="size-4" />
    </span>
  );
}

export type DetailAttentionTableProps = {
  rows: readonly DetailAttentionRow[];
  title?: string;
  onDismissAll?: () => void;
  dismissAllLabel?: string;
  emptyMessage?: string;
  className?: string;
};

/** Attention-required table for overview-style detail tabs. */
export function DetailAttentionTable({
  rows,
  title = "Attention required",
  onDismissAll,
  dismissAllLabel = "Dismiss all",
  emptyMessage,
  className,
}: DetailAttentionTableProps) {
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
      <div className="flex items-center justify-between gap-3 border-b border-shell-stroke px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <h2 className="font-headline text-base font-semibold text-on-surface">{title}</h2>
          <Badge
            variant="destructive"
            className="h-6 min-w-6 rounded-full px-2 font-label text-xs font-semibold"
          >
            {rows.length}
          </Badge>
        </div>
        {onDismissAll ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-9"
            onClick={onDismissAll}
          >
            {dismissAllLabel}
          </Button>
        ) : null}
      </div>
      <div className="overflow-x-auto p-4 sm:p-6">
        <table className="w-full min-w-[32rem] text-left font-body text-sm">
          <thead>
            <tr className="border-b border-shell-stroke font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              <th className="pb-3 pr-4">Title</th>
              <th className="pb-3 pr-4">Num</th>
              <th className="pb-3 pr-4">Type</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-shell-stroke/60 last:border-0">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <AttentionRowIcon {...(row.iconKind ? { kind: row.iconKind } : {})} />
                    <span className="text-on-surface">{row.title}</span>
                  </div>
                </td>
                <td className="py-3 pr-4 tabular-nums text-on-surface-variant">{row.count}</td>
                <td className="py-3 pr-4 text-on-surface-variant">{row.category}</td>
                <td className="py-3 pr-4">
                  <Badge
                    variant={SEVERITY_VARIANT[row.severity]}
                    className="font-label text-[10px] uppercase"
                  >
                    {SEVERITY_LABEL[row.severity]}
                  </Badge>
                </td>
                <td className="py-3 text-right">
                  {row.href ? (
                    <Link href={row.href} className="font-label text-xs text-link hover:underline">
                      {row.actionLabel}
                    </Link>
                  ) : (
                    <span className="text-on-surface-variant">{row.actionLabel}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
