import { DetailCardGrid } from "@/components/admin/catalog/detail-board";
import { categoryDetailTabHref } from "@/components/admin/category-detail/category-detail-types";
import type { CategoryUsage } from "@auction/types";

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
        <DetailCardGrid
          columns={2}
          items={rows.map((row) => ({
            id: row.id,
            title: row.label,
            meta: String(row.value),
            ...(row.href ? { href: row.href } : {}),
          }))}
        />
        <div className="flex items-center justify-between gap-3 border-t border-border-hairline pt-3 text-sm">
          <span className="font-medium text-on-surface">Total</span>
          <span className="font-semibold tabular-nums text-on-surface">{usage.total}</span>
        </div>
        <p className="text-sm text-on-surface-variant">{guidance}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-body text-sm text-on-surface-variant">
        Used by {usage.lots} lots, {usage.sales} sales, and {usage.submissions} submissions.
      </p>
      <DetailCardGrid
        columns={3}
        items={rows.map((row) => ({
          id: row.id,
          title: row.label,
          meta: (
            <span className="font-display text-lg font-semibold tabular-nums text-on-surface">
              {row.value}
            </span>
          ),
          ...(row.href ? { href: row.href } : {}),
        }))}
      />
      <p className="rounded-lg border border-border-hairline/60 bg-surface-container-low/30 px-4 py-3 text-sm text-on-surface-variant">
        <span className="font-medium text-on-surface">{usage.total} total references.</span>{" "}
        {guidance}
      </p>
    </div>
  );
}
