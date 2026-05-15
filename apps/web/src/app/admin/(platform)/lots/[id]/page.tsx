import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { AdminLotConnectRequiredBanner } from "@/components/admin/admin-lot-connect-required-banner";
import { AdminLotDetailActions } from "@/components/admin/admin-lot-detail-actions";
import { LotDocumentsSection } from "@/components/admin/lot-form/lot-documents-section";
import { LotImageTab } from "@/components/admin/lot-image-tab";
import { lotStatusLabel, lotStatusToBadgeVariant } from "@/lib/admin/status-badge-variants";
import { getAdminLotById } from "@/lib/data/http/admin.server";
import { getServerLotDocuments } from "@/lib/data/http/lot-documents.server";
import { getServerLotBids } from "@/lib/data/http/lots.server";
import { StatusBadge, Tabs, TabsContent, TabsList, TabsTrigger } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@auction/ui/components/card";
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
      breadcrumbs={
        <Link
          href="/admin/lots"
          className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
        >
          ← Lots
        </Link>
      }
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

      <Tabs defaultValue="overview">
        <TabsList className="mb-6 flex flex-wrap gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="images">
            Images {auction.images.length > 0 ? `(${auction.images.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="documents">
            Documents {lotDocuments.length > 0 ? `(${lotDocuments.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
          <TabsTrigger value="bids">Bids {bids.length > 0 ? `(${bids.length})` : ""}</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* --- Overview tab --- */}
        <TabsContent value="overview">
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoCard title="Status">
              <StatusBadge variant={lotStatusToBadgeVariant(auction.status)}>
                {lotStatusLabel[auction.status] ?? auction.status}
              </StatusBadge>
            </InfoCard>

            {auction.saleId ? (
              <InfoCard title="Sale">
                <Link
                  href={`/admin/sales/${auction.saleId}`}
                  className="font-medium text-primary hover:underline"
                >
                  View sale ↗
                </Link>
                {auction.lotNumber ? (
                  <span className="ml-2 font-body text-xs text-on-surface-variant">
                    Lot #{auction.lotNumber}
                  </span>
                ) : null}
              </InfoCard>
            ) : (
              <InfoCard title="Sale">
                <span className="text-on-surface-variant">Not assigned to a sale</span>
              </InfoCard>
            )}

            <InfoCard title="Seller legal entity">
              {auction.sellerLegalEntityId ? (
                <Link
                  href={`/admin/legal-entities/${auction.sellerLegalEntityId}`}
                  className="font-mono text-sm text-primary hover:underline"
                >
                  {auction.sellerLegalEntityId.slice(0, 8)}…
                </Link>
              ) : (
                <span className="text-on-surface-variant">Not set</span>
              )}
            </InfoCard>

            <InfoCard title="Auction type">
              <span className="capitalize">{auction.auctionType}</span>
            </InfoCard>

            <InfoCard title="Starting price">
              <span className="tabular-nums">{auction.startingPrice}</span>
              {auction.reservePrice ? (
                <span className="ml-2 text-xs text-on-surface-variant">
                  Reserve: {auction.reservePrice}
                </span>
              ) : null}
            </InfoCard>

            <InfoCard title="Current hammer">
              <span className="tabular-nums font-semibold">{auction.currentPrice}</span>
            </InfoCard>

            <InfoCard title="Schedule">
              <div className="space-y-0.5 font-body text-sm">
                <p>
                  <span className="text-on-surface-variant">Start:</span>{" "}
                  {auction.startTime.toLocaleString()}
                </p>
                <p>
                  <span className="text-on-surface-variant">End:</span>{" "}
                  {auction.endTime.toLocaleString()}
                </p>
              </div>
            </InfoCard>

            <InfoCard title="Artist">
              {auction.artistId ? (
                <Link
                  href={`/admin/artists/${auction.artistId}`}
                  className="font-medium text-primary hover:underline"
                >
                  View artist ↗
                </Link>
              ) : (
                <span className="text-on-surface-variant">Not assigned</span>
              )}
              {auction.artistReviewRequired ? (
                <span className="ml-2 rounded bg-warning/10 px-1.5 py-0.5 font-label text-[10px] uppercase tracking-wider text-warning">
                  Review required
                </span>
              ) : null}
            </InfoCard>

            {(auction.categoryIds?.length ?? 0) > 0 ? (
              <InfoCard title="Categories">
                <div className="flex flex-wrap gap-1">
                  {(auction.categoryIds ?? []).map((cid) => (
                    <span
                      key={cid}
                      className="rounded bg-surface-container-high px-2 py-0.5 font-mono text-xs text-on-surface-variant"
                    >
                      {cid.slice(0, 8)}…
                    </span>
                  ))}
                </div>
              </InfoCard>
            ) : null}

            {auction.medium || auction.dimensions ? (
              <InfoCard title="Physical details">
                {auction.medium ? <p className="text-sm">{auction.medium}</p> : null}
                {auction.dimensions ? (
                  <p className="text-xs text-on-surface-variant">{auction.dimensions}</p>
                ) : null}
              </InfoCard>
            ) : null}
          </div>
        </TabsContent>

        {/* --- Images tab --- */}
        <TabsContent value="images">
          <LotImageTab lotId={id} initialImages={auction.images} initialAlts={imageAlts} />
        </TabsContent>

        {/* --- Documents tab --- */}
        <TabsContent value="documents">
          <LotDocumentsSection lotId={id} initialDocuments={lotDocuments} />
        </TabsContent>

        {/* --- Marketing tab --- */}
        <TabsContent value="marketing">
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
                  className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
                >
                  Edit →
                </Link>
              ) : null}
            </div>

            {auction.marketingDetails?.conditionReport?.summary ? (
              <div className="rounded-lg border border-outline-variant/20 p-4">
                <p className="mb-1 font-label text-[10px] uppercase tracking-wider text-secondary">
                  Condition summary
                </p>
                <p className="font-body text-sm">
                  {auction.marketingDetails.conditionReport.summary}
                </p>
              </div>
            ) : null}

            {auction.marketingDetails?.estimate ? (
              <div className="rounded-lg border border-outline-variant/20 p-4">
                <p className="mb-1 font-label text-[10px] uppercase tracking-wider text-secondary">
                  Estimate
                </p>
                <p className="font-body text-sm">
                  {auction.marketingDetails.estimate.low} – {auction.marketingDetails.estimate.high}{" "}
                  {auction.marketingDetails.estimate.currency}
                </p>
              </div>
            ) : null}

            {!auction.marketingDetails?.conditionReport?.summary &&
            !auction.marketingDetails?.estimate ? (
              <p className="text-sm text-on-surface-variant">No marketing details yet.</p>
            ) : null}
          </div>
        </TabsContent>

        {/* --- Activity tab --- */}
        <TabsContent value="activity">
          <div className="space-y-3">
            <p className="font-body text-sm text-on-surface-variant">
              Full audit trail for this lot scoped to aggregate{" "}
              <span className="font-mono">lot / {id}</span>.
            </p>
            <Link
              href={`/admin/audit/timeline?aggregateType=lot&aggregateId=${id}`}
              className="inline-flex items-center gap-1 font-label text-xs uppercase tracking-widest text-primary hover:underline"
            >
              Open audit timeline ↗
            </Link>
          </div>
        </TabsContent>

        {/* --- Bids tab --- */}
        <TabsContent value="bids">
          {bids.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No bids yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-outline-variant/20">
              <table className="w-full font-body text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/20 bg-surface-container-low/40">
                    <th className="px-4 py-2 text-left font-label text-[10px] uppercase tracking-widest text-secondary">
                      Amount
                    </th>
                    <th className="px-4 py-2 text-left font-label text-[10px] uppercase tracking-widest text-secondary">
                      Type
                    </th>
                    <th className="px-4 py-2 text-left font-label text-[10px] uppercase tracking-widest text-secondary">
                      Bidder
                    </th>
                    <th className="px-4 py-2 text-left font-label text-[10px] uppercase tracking-widest text-secondary">
                      Placed
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((b) => (
                    <tr
                      key={b.id}
                      className={`border-b border-outline-variant/10 last:border-0 ${
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
          )}
        </TabsContent>
      </Tabs>
    </AdminEntityDetailShell>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-outline-variant/15 bg-surface-container-low/30">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="font-label text-[10px] uppercase tracking-widest text-secondary">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">{children}</CardContent>
    </Card>
  );
}
