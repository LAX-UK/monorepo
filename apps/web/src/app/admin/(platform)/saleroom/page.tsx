import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { AdminSaleroomHubBoard } from "@/components/admin/saleroom-hub-board";
import { getAdminSalesList } from "@/lib/data/http/admin.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Saleroom console",
  "Pick a live or upcoming sale to open the clerk console.",
);

export default async function AdminSaleroomHubPage() {
  let sales: Awaited<ReturnType<typeof getAdminSalesList>> = [];
  let loadError: string | null = null;
  try {
    sales = await getAdminSalesList({ limit: 50 });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load sales.";
  }

  const liveOrUpcoming = sales.filter(
    (row) =>
      row.sale.deliveryMode === "onsite" &&
      (row.sale.status === "active" || row.sale.status === "scheduled"),
  );
  const liveCount = liveOrUpcoming.filter((row) => row.sale.status === "active").length;
  const scheduledCount = liveOrUpcoming.filter((row) => row.sale.status === "scheduled").length;

  const empty =
    !loadError && liveOrUpcoming.length === 0 ? (
      <AdminEmptyState
        title="No live or upcoming sales"
        description="Schedule or activate a sale to open the clerk console."
        action={
          <Link
            href="/admin/sales"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-primary"
          >
            Go to sales
          </Link>
        }
      />
    ) : null;

  return (
    <AdminListShell
      layout="hub"
      title="Saleroom console"
      description="Pick a live or upcoming sale to open the clerk console."
      kpiStrip={
        !loadError ? (
          <AdminListKpiStrip
            ariaLabel="Saleroom summary"
            tiles={[
              { label: "Live sales", value: liveCount },
              { label: "Scheduled", value: scheduledCount },
              { label: "Available", value: liveOrUpcoming.length },
            ]}
          />
        ) : null
      }
      mobileSummary={
        !loadError ? (
          <CatalogListMobileSummary
            metrics={[
              { id: "live", label: "Live", value: String(liveCount) },
              { id: "scheduled", label: "Scheduled", value: String(scheduledCount) },
              { id: "total", label: "Available", value: String(liveOrUpcoming.length) },
            ]}
          />
        ) : null
      }
      errorAlert={
        loadError ? <AdminListAlert title="Could not load sales">{loadError}</AdminListAlert> : null
      }
      view={
        !loadError && liveOrUpcoming.length > 0 ? (
          <AdminSaleroomHubBoard rows={liveOrUpcoming} />
        ) : null
      }
      empty={empty}
    />
  );
}
