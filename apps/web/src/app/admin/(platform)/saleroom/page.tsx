import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminHubQuickLinks } from "@/components/admin/admin-hub-quick-links";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { AdminSaleroomHubBoard } from "@/components/admin/saleroom-hub-board";
import { saleroomHubController } from "@/lib/admin/saleroom-hub-controller";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Saleroom console",
  "Pick a live or upcoming sale to open the clerk console.",
);

export default async function AdminSaleroomHubPage() {
  let liveOrUpcoming: Awaited<ReturnType<typeof saleroomHubController.fetch>>["rows"] = [];
  let liveCount = 0;
  let scheduledCount = 0;
  let loadError: string | null = null;
  try {
    const result = await saleroomHubController.fetch();
    liveOrUpcoming = result.rows;
    liveCount = result.summary.liveCount;
    scheduledCount = result.summary.scheduledCount;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load sales.";
  }

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
        <div className="space-y-8">
          <AdminHubQuickLinks
            ariaLabel="Saleroom quick links"
            links={[
              { href: "/admin/sales", label: "All sales" },
              { href: "/admin/onsite-events", label: "Onsite events" },
              { href: "/admin/lots?lens=attention", label: "Lots attention" },
            ]}
          />
          {!loadError && liveOrUpcoming.length > 0 ? (
            <AdminSaleroomHubBoard rows={liveOrUpcoming} />
          ) : null}
        </div>
      }
      empty={empty}
    />
  );
}
