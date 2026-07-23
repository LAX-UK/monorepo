import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { CatalogDetailTabCard } from "@/components/admin/catalog";
import { DetailBoardKpiStrip } from "@/components/admin/catalog/detail-board";
import { DetailEntityTable } from "@/components/admin/catalog/detail-board";
import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import { formatAdminTableDateTime } from "@/lib/admin/format-admin-table-datetime";
import { buildSaleScheduleKpiTiles } from "@/lib/data/view-models/sale-schedule-tab.vm";
import type { Lot, Sale } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";
import Link from "next/link";

type Props = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
};

function scheduleRelativeLabel(sale: Sale): string | null {
  const now = new Date();
  if (sale.status === "active" && sale.endTime.getTime() > now.getTime()) {
    return formatAdminTableDateTime(sale.endTime, "deadline", { now }).primary;
  }
  if (sale.status === "scheduled" && sale.startTime.getTime() > now.getTime()) {
    return formatAdminTableDateTime(sale.startTime, "deadline", {
      now,
      deadlineKind: "start",
    }).primary;
  }
  return null;
}

export function SaleScheduleTab({ saleId, sale, lots }: Props) {
  const relative = scheduleRelativeLabel(sale);
  const previewLots = lots.slice(0, 10);
  const kpiTiles = buildSaleScheduleKpiTiles(sale, lots);

  return (
    <div className="space-y-6">
      <DetailBoardKpiStrip ariaLabel="Schedule summary" tiles={kpiTiles} />

      <CatalogDetailTabCard
        title="Schedule"
        description="Sale window, preview timing, and per-lot schedules. Edit the sale draft to change sale-level dates."
      >
        <div className="space-y-8">
          <div className="relative space-y-0 border-l-2 border-shell-stroke pl-6">
            {sale.previewStartTime ? (
              <ScheduleMilestone
                label="Preview opens"
                iso={sale.previewStartTime}
                mode="timestamp"
                relative={null}
              />
            ) : null}
            <ScheduleMilestone
              label="Sale starts"
              iso={sale.startTime}
              mode="deadline"
              deadlineKind="start"
              relative={sale.status === "scheduled" ? relative : null}
              active={sale.status === "scheduled" || sale.status === "active"}
            />
            <ScheduleMilestone
              label="Sale ends"
              iso={sale.endTime}
              mode="deadline"
              live
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
              {isSaleroomDeliveryMode(sale.deliveryMode)
                ? "Saleroom lots typically share the sale window above."
                : "Each online lot has its own start/end."}
            </p>
            {previewLots.length === 0 ? (
              <p className="mt-4 rounded-md border border-dashed border-outline-variant/40 p-4 text-sm text-on-surface-variant">
                No lots attached yet.{" "}
                <Link
                  href={saleDetailTabHref(saleId, "lots")}
                  className="text-link hover:underline"
                >
                  Add lots →
                </Link>
              </p>
            ) : (
              <div className="mt-4">
                <DetailEntityTable
                  rows={previewLots}
                  getRowId={(lot) => lot.id}
                  emptyTitle="No lots attached yet."
                  columns={[
                    {
                      id: "lot",
                      header: "Lot",
                      cell: (lot) => (
                        <Link
                          href={`/admin/lots/${lot.id}`}
                          className="font-medium text-link hover:underline"
                        >
                          {lot.lotNumber != null ? `#${lot.lotNumber} · ` : ""}
                          {lot.title}
                        </Link>
                      ),
                    },
                    {
                      id: "start",
                      header: "Start",
                      cell: (lot) => (
                        <AdminTableDateTimeCell
                          iso={lot.startTime}
                          mode="deadline"
                          deadlineKind="start"
                        />
                      ),
                    },
                    {
                      id: "end",
                      header: "End",
                      cell: (lot) => (
                        <AdminTableDateTimeCell iso={lot.endTime} mode="deadline" live />
                      ),
                    },
                  ]}
                />
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
      </CatalogDetailTabCard>
    </div>
  );
}

function ScheduleMilestone({
  label,
  iso,
  mode = "timestamp",
  deadlineKind = "end",
  live = false,
  relative,
  active = false,
}: {
  label: string;
  iso: Date | string;
  mode?: "deadline" | "timestamp" | "dateOnly";
  deadlineKind?: "end" | "start";
  live?: boolean;
  relative: string | null;
  active?: boolean;
}) {
  return (
    <div className="relative pb-8 last:pb-0">
      <span
        className={`absolute -left-[1.65rem] top-1 size-3 rounded-full border-2 ${
          active ? "border-secondary bg-secondary" : "border-shell-stroke bg-surface"
        }`}
        aria-hidden
      />
      <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        {label}
      </p>
      <div className="mt-1 tabular-nums text-on-surface">
        <AdminTableDateTimeCell iso={iso} mode={mode} deadlineKind={deadlineKind} live={live} />
      </div>
      {relative ? <p className="mt-0.5 text-xs text-secondary">{relative}</p> : null}
    </div>
  );
}
