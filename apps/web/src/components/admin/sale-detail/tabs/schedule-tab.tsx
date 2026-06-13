import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import { formatDateTime, formatRelativeTime } from "@/lib/ui/format";
import type { Lot, Sale } from "@auction/types";
import Link from "next/link";

type Props = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
};

function scheduleRelativeLabel(sale: Sale): string | null {
  const now = Date.now();
  if (sale.status === "active" && sale.endTime.getTime() > now) {
    return `Ends ${formatRelativeTime(sale.endTime)}`;
  }
  if (sale.status === "scheduled" && sale.startTime.getTime() > now) {
    return `Starts ${formatRelativeTime(sale.startTime)}`;
  }
  return null;
}

export function SaleScheduleTab({ saleId, sale, lots }: Props) {
  const relative = scheduleRelativeLabel(sale);
  const previewLots = lots.slice(0, 10);

  return (
    <CatalogDetailTabPanel
      title="Schedule"
      description="Sale window, preview timing, and per-lot schedules. Edit the sale draft to change sale-level dates."
    >
      <div className="space-y-8">
        <div className="relative space-y-0 border-l-2 border-border-hairline pl-6">
          {sale.previewStartTime ? (
            <ScheduleMilestone
              label="Preview opens"
              when={formatDateTime(sale.previewStartTime)}
              relative={null}
            />
          ) : null}
          <ScheduleMilestone
            label="Sale starts"
            when={formatDateTime(sale.startTime)}
            relative={sale.status === "scheduled" ? relative : null}
            active={sale.status === "scheduled" || sale.status === "active"}
          />
          <ScheduleMilestone
            label="Sale ends"
            when={formatDateTime(sale.endTime)}
            relative={sale.status === "active" ? relative : null}
            active={sale.status === "active"}
          />
        </div>

        <p className="text-xs text-on-surface-variant">
          Displayed in your browser locale. Cross-check with published catalog copy for the
          canonical timezone.{" "}
          <Link href={`/admin/sales/${saleId}/edit`} className="text-link hover:underline">
            Edit sale schedule →
          </Link>
        </p>

        <div>
          <h3 className="font-display text-base font-semibold tracking-tight text-on-surface">
            Per-lot timing
          </h3>
          <p className="mt-1 font-body text-sm text-on-surface-variant">
            {sale.deliveryMode === "onsite"
              ? "Onsite lots typically share the sale window above."
              : "Each online lot has its own start/end."}
          </p>
          {previewLots.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed border-outline-variant/40 p-4 text-sm text-on-surface-variant">
              No lots attached yet.{" "}
              <Link href={saleDetailTabHref(saleId, "lots")} className="text-link hover:underline">
                Add lots →
              </Link>
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left font-body text-sm">
                <thead>
                  <tr className="border-b border-border-hairline font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                    <th className="pb-2 pr-4">Lot</th>
                    <th className="pb-2 pr-4">Start</th>
                    <th className="pb-2">End</th>
                  </tr>
                </thead>
                <tbody>
                  {previewLots.map((lot) => (
                    <tr key={lot.id} className="border-b border-border-hairline/60">
                      <td className="py-2.5 pr-4">
                        <Link
                          href={`/admin/lots/${lot.id}`}
                          className="font-medium text-link hover:underline"
                        >
                          {lot.lotNumber != null ? `#${lot.lotNumber} · ` : ""}
                          {lot.title}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums text-on-surface-variant">
                        {formatDateTime(lot.startTime)}
                      </td>
                      <td className="py-2.5 tabular-nums text-on-surface-variant">
                        {formatDateTime(lot.endTime)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lots.length > previewLots.length ? (
                <p className="mt-3 text-xs text-on-surface-variant">
                  Showing {previewLots.length} of {lots.length} lots.{" "}
                  <Link
                    href={saleDetailTabHref(saleId, "lots")}
                    className="text-link hover:underline"
                  >
                    View all lots →
                  </Link>
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </CatalogDetailTabPanel>
  );
}

function ScheduleMilestone({
  label,
  when,
  relative,
  active = false,
}: {
  label: string;
  when: string;
  relative: string | null;
  active?: boolean;
}) {
  return (
    <div className="relative pb-8 last:pb-0">
      <span
        className={`absolute -left-[1.65rem] top-1 size-3 rounded-full border-2 ${
          active ? "border-primary bg-primary" : "border-border-hairline bg-surface"
        }`}
        aria-hidden
      />
      <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        {label}
      </p>
      <p className="mt-1 tabular-nums text-on-surface">{when}</p>
      {relative ? <p className="mt-0.5 text-xs text-primary">{relative}</p> : null}
    </div>
  );
}
