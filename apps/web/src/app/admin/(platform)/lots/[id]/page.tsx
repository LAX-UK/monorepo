import { ActivityTimelinePanel } from "@/components/admin/activity-timeline-panel";
import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { AdminLotConnectRequiredBanner } from "@/components/admin/admin-lot-connect-required-banner";
import { AdminLotDetailActions } from "@/components/admin/admin-lot-detail-actions";
import { AdminLotOverviewPanel } from "@/components/admin/admin-lot-overview-panel";
import { LotDocumentsSection } from "@/components/admin/lot-form/lot-documents-section";
import { LotImageTab } from "@/components/admin/lot-image-tab";
import { AdminDetailTabs } from "@/components/dashboard/primitives/admin-detail-tabs";
import { lotStatusLabel, lotStatusToBadgeVariant } from "@/lib/admin/status-badge-variants";
import { getAdminLotById } from "@/lib/data/http/admin.server";
import { getServerLotDocuments } from "@/lib/data/http/lot-documents.server";
import { getServerLotBids } from "@/lib/data/http/lots.server";
import { StatusBadge } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminLotDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; error_code?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const [auction, lotDocuments, bids] = await Promise.all([
    getAdminLotById(id).catch(() => null),
    getServerLotDocuments(id).catch(() => []),
    getServerLotBids(id, 100).catch(() => []),
  ]);

  if (!auction) notFound();

  const canPublish = auction.status === "draft";
  const canCancel =
    auction.status === "draft" || auction.status === "scheduled" || auction.status === "active";

  const imageAlts = auction.marketingDetails.imageAlts ?? [];

  return (
    <AdminEntityDetailShell
      detailHeader
      backHref="/admin/lots"
      backLabel="Lots"
      eyebrow="Catalogue lot"
      title={auction.title}
      meta={
        <StatusBadge variant={lotStatusToBadgeVariant(auction.status)}>
          {lotStatusLabel[auction.status] ?? auction.status}
        </StatusBadge>
      }
      description={auction.description ?? undefined}
      actions={
        <AdminLotDetailActions
          key={id}
          lotId={id}
          sellerLegalEntityId={auction.sellerLegalEntityId ?? null}
          canPublish={canPublish}
          canCancel={canCancel}
          showEditDraft={auction.status === "draft"}
          showEditCatalog={
            auction.status === "draft" ||
            auction.status === "scheduled" ||
            auction.status === "active"
          }
        />
      }
    >
      {sp.error_code === "connect_required" ? (
        <AdminLotConnectRequiredBanner
          sellerLegalEntityId={auction.sellerLegalEntityId ?? null}
          detail={sp.error ?? null}
        />
      ) : sp.error ? (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{sp.error}</AlertDescription>
        </Alert>
      ) : null}

      <AdminDetailTabs
        defaultValue="overview"
        tabs={[
          {
            value: "overview",
            label: "Overview",
            content: (
              <AdminLotOverviewPanel
                auction={auction}
                imageAlts={imageAlts.filter(Boolean) as string[]}
              />
            ),
          },
          {
            value: "images",
            label: `Images${auction.images.length > 0 ? ` (${auction.images.length})` : ""}`,
            content: (
              <LotImageTab lotId={id} initialImages={auction.images} initialAlts={imageAlts} />
            ),
          },
          {
            value: "documents",
            label: `Documents${lotDocuments.length > 0 ? ` (${lotDocuments.length})` : ""}`,
            content: <LotDocumentsSection lotId={id} initialDocuments={lotDocuments} />,
          },
          {
            value: "marketing",
            label: "Marketing",
            content: (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-body text-sm text-on-surface-variant">
                    Condition report, estimate, provenance, exhibitions, and artist note.
                  </p>
                  {auction.status === "draft" ||
                  auction.status === "scheduled" ||
                  auction.status === "active" ? (
                    <Link
                      href={`/admin/lots/${id}/edit`}
                      className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
                    >
                      Edit →
                    </Link>
                  ) : null}
                </div>

                {auction.marketingDetails?.conditionReport?.summary ? (
                  <div className="rounded-lg border border-border-hairline p-4">
                    <p className="mb-1 font-label text-[10px] uppercase tracking-wider text-secondary">
                      Condition summary
                    </p>
                    <p className="font-body text-sm">
                      {auction.marketingDetails.conditionReport.summary}
                    </p>
                  </div>
                ) : null}

                {auction.marketingDetails?.estimate ? (
                  <div className="rounded-lg border border-border-hairline p-4">
                    <p className="mb-1 font-label text-[10px] uppercase tracking-wider text-secondary">
                      Estimate
                    </p>
                    <p className="font-body text-sm">
                      {auction.marketingDetails.estimate.low} –{" "}
                      {auction.marketingDetails.estimate.high}{" "}
                      {auction.marketingDetails.estimate.currency}
                    </p>
                  </div>
                ) : null}

                {!auction.marketingDetails?.conditionReport?.summary &&
                !auction.marketingDetails?.estimate ? (
                  <p className="text-sm text-on-surface-variant">No marketing details yet.</p>
                ) : null}
              </div>
            ),
          },
          {
            value: "bids",
            label: `Bids${bids.length > 0 ? ` (${bids.length})` : ""}`,
            content:
              bids.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No bids yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border-hairline">
                  <table className="w-full font-body text-sm">
                    <thead>
                      <tr className="border-b border-border-hairline bg-surface-container-low/40">
                        <th className="px-4 py-2 text-left font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                          Amount
                        </th>
                        <th className="px-4 py-2 text-left font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                          Type
                        </th>
                        <th className="px-4 py-2 text-left font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                          Bidder
                        </th>
                        <th className="px-4 py-2 text-left font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                          Placed
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bids.map((b) => (
                        <tr
                          key={b.id}
                          className={`border-b border-border-hairline last:border-0 ${
                            b.isWinning ? "bg-success/5" : ""
                          }`}
                        >
                          <td className="px-4 py-2 tabular-nums font-medium">
                            {b.amount}
                            {b.isWinning ? (
                              <span className="ml-2 rounded bg-success/10 px-1.5 py-0.5 font-label text-[10px] uppercase text-success">
                                Winning
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-2 text-on-surface-variant">
                            {b.isAutoBid ? "Auto" : "Manual"}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-on-surface-variant">
                            {(b.bidderId ?? "").slice(0, 12)}…
                          </td>
                          <td className="px-4 py-2 text-xs text-on-surface-variant">
                            {b.createdAt.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ),
          },
          {
            value: "activity",
            label: "Activity",
            content: <ActivityTimelinePanel aggregateType="lot" aggregateId={id} />,
          },
        ]}
      />
    </AdminEntityDetailShell>
  );
}
