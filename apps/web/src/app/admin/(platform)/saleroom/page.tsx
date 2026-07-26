import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminHubQuickLinks } from "@/components/admin/admin-hub-quick-links";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { StaffHubShell } from "@/components/admin/catalog/staff-hub-shell";
import { AdminSaleroomHubBoard } from "@/components/admin/saleroom-hub-board";
import { SaleroomHubLiveGrid } from "@/components/admin/saleroom-hub-board/saleroom-hub-live-grid";
import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import { loadSaleroomHubPage } from "@/lib/admin/saleroom/load-saleroom-hub-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Saleroom console",
  "Monitor live rooms and open the clerk console for each sale.",
);

export default async function AdminSaleroomHubPage() {
  const { summary, hubView, loadError } = await loadSaleroomHubPage();
  const { liveCount, scheduledCount, availableCount } = summary;

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
    <StaffHubShell
      title="Saleroom console"
      description="Monitor all live rooms or open a clerk console to run the floor."
      kpiStrip={
        !loadError ? (
          <AdminTrendKpiBand
            ariaLabel="Saleroom summary"
            tiles={[
              buildSnapshotKpiTile("Live sales", liveCount, 30, {
                compareHint: "Active or paused rooms",
                semanticTone: liveCount > 0 ? "emphasis" : "default",
              }),
              buildSnapshotKpiTile("Scheduled", scheduledCount, 30, {
                compareHint: "Upcoming salerooms",
              }),
              buildSnapshotKpiTile("Available", availableCount, 30, {
                compareHint: "Open clerk consoles",
              }),
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
