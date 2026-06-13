import { categoryDetailTabHref } from "@/components/admin/category-detail/category-detail-types";
import type { CategoryUsage } from "@auction/types";
import Link from "next/link";

type Props = {
  categoryId: string;
  usage: CategoryUsage;
  /** Sidebar layout on edit form */
  compact?: boolean;
};

type UsageRow = {
  id: string;
  label: string;
  value: number;
  href?: string;
};

function usageRows(categoryId: string, usage: CategoryUsage): UsageRow[] {
  return [
    {
      id: "lots",
      label: "Lots",
      value: usage.lots,
      ...(usage.lots > 0 ? { href: categoryDetailTabHref(categoryId, "lots") } : {}),
    },
    {
      id: "sales",
      label: "Sales",
      value: usage.sales,
      ...(usage.sales > 0 ? { href: categoryDetailTabHref(categoryId, "sales") } : {}),
    },
    {
      id: "submissions",
      label: "Submissions",
      value: usage.submissions,
      ...(usage.submissions > 0
        ? { href: `/admin/submissions?categoryId=${encodeURIComponent(categoryId)}` }
        : {}),
    },
  ];
}

function UsageCount({ row }: { row: UsageRow }) {
  const value = (
    <span className="font-display text-lg font-semibold tabular-nums text-on-surface">
      {row.value}
    </span>
  );
  if (row.href) {
    return (
      <Link href={row.href} className="hover:text-link">
        {value}
      </Link>
    );
  }
  return value;
}

export function CategoryUsagePanel({ categoryId, usage, compact = false }: Props) {
  const rows = usageRows(categoryId, usage);
  const guidance =
    usage.total > 0
      ? "Used categories should be archived to preserve catalog history."
      : "Unused categories can be deleted from the category tree.";

  if (compact) {
    return (
      <div className="space-y-4">
        <h3 className="font-headline text-base font-semibold text-on-surface">Usage</h3>
        <dl className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 text-sm">
              <dt className="text-on-surface-variant">{row.label}</dt>
              <dd>
                <UsageCount row={row} />
              </dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 border-t border-border-hairline pt-3 text-sm">
            <dt className="font-medium text-on-surface">Total</dt>
            <dd className="font-semibold tabular-nums text-on-surface">{usage.total}</dd>
          </div>
        </dl>
        <p className="text-sm text-on-surface-variant">{guidance}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-body text-sm text-on-surface-variant">
        Used by {usage.lots} lots, {usage.sales} sales, and {usage.submissions} submissions.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {rows.map((row) => (
          <div
            key={row.id}
            className="rounded-lg border border-border-hairline bg-surface-container-low/40 p-4"
          >
            <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              {row.label}
            </p>
            <p className="mt-2">
              <UsageCount row={row} />
            </p>
            {row.href ? (
              <Link
                href={row.href}
                className="mt-2 inline-block font-label text-xs font-semibold uppercase tracking-wide text-link hover:underline"
              >
                View all →
              </Link>
            ) : null}
          </div>
        ))}
      </div>
      <p className="rounded-lg border border-border-hairline/60 bg-surface-container-low/30 px-4 py-3 text-sm text-on-surface-variant">
        <span className="font-medium text-on-surface">{usage.total} total references.</span>{" "}
        {guidance}
      </p>
    </div>
  );
}
