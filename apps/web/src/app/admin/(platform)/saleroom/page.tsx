import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminHubQuickLinks } from "@/components/admin/admin-hub-quick-links";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { AdminSaleroomHubBoard } from "@/components/admin/saleroom-hub-board";
import { SaleroomHubLiveGrid } from "@/components/admin/saleroom-hub-board/saleroom-hub-live-grid";
import { saleroomHubController } from "@/lib/admin/saleroom-hub-controller";
import { buildSaleroomHubViewData } from "@/lib/admin/saleroom-hub-page-data";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Saleroom console",
  "Monitor live rooms and open the clerk console for each sale.",
);

export default async function AdminSaleroomHubPage() {
  let liveCount = 0;
  let scheduledCount = 0;
  let availableCount = 0;
  let loadError: string | null = null;
  let hubView: Awaited<ReturnType<typeof buildSaleroomHubViewData>> | null = null;

  try {
    const result = await saleroomHubController.fetch();
    liveCount = result.summary.liveCount;
    scheduledCount = result.summary.scheduledCount;
    availableCount = result.summary.availableCount;
    hubView = await buildSaleroomHubViewData(result.rows);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load sales.";
  }

  const empty =
    !loadError && availableCount === 0 ? (
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
      description="Monitor all live rooms or open a clerk console to run the floor."
      kpiStrip={
        !loadError ? (
          <AdminListKpiStrip
            ariaLabel="Saleroom summary"
            tiles={[
              { label: "Live sales", value: liveCount },
              { label: "Scheduled", value: scheduledCount },
              { label: "Available", value: availableCount },
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
              { id: "total", label: "Available", value: String(availableCount) },
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
              { href: "/admin/event-rsvps", label: "Event RSVPs" },
              { href: "/admin/lots?lens=attention", label: "Lots attention" },
            ]}
          />
          {!loadError && hubView && hubView.summaries.length > 0 ? (
            <SaleroomHubLiveGrid
              rows={hubView.summaries}
              initialSessions={hubView.initialSessions}
            />
          ) : null}
          {!loadError && hubView && hubView.scheduledOnlyRows.length > 0 ? (
            <div className="space-y-3">
              <h2 className="font-headline text-lg text-on-surface">Scheduled</h2>
              <AdminSaleroomHubBoard rows={hubView.scheduledOnlyRows} />
            </div>
          ) : null}
          {!loadError &&
          hubView &&
          hubView.summaries.length === 0 &&
          hubView.scheduledOnlyRows.length === 0 &&
          availableCount > 0 ? (
            <AdminSaleroomHubBoard rows={hubView.rows} />
          ) : null}
        </div>
      }
      empty={empty}
    />
  );
}
