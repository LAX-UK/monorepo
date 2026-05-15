import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { AdminSaleHeaderActions } from "@/components/admin/admin-sale-header-actions";
import { SaleDocumentsSection } from "@/components/admin/sale-form/sale-documents-section";
import { SaleLotsTabSection } from "@/components/admin/sale-lots-tab-section";
import { saleStatusLabel, saleStatusToBadgeVariant } from "@/lib/admin/status-badge-variants";
import {
  type AdminSaleRegistrationRow,
  getAdminLotList,
  getAdminSaleById,
  getAdminSaleRegistrations,
} from "@/lib/data/http/admin.server";
import { getServerSaleDocuments } from "@/lib/data/http/sale-documents.server";
import type { Lot, Sale } from "@auction/types";
import { Button, StatusBadge, Tabs, TabsContent, TabsList, TabsTrigger } from "@auction/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@auction/ui/components/card";
import Link from "next/link";
import { notFound } from "next/navigation";

function sumLotHammers(lots: Lot[]): string {
  let total = 0;
  for (const l of lots) {
    const n = Number.parseFloat(String(l.currentPrice ?? "0"));
    if (!Number.isNaN(n)) total += n;
  }
  return total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function buyerPremiumSummary(sale: Sale): string {
  const tiers = sale.buyerPremiumTiers;
  if (tiers && tiers.length > 0) {
    return `${tiers.length} tier${tiers.length === 1 ? "" : "s"} (${tiers.map((t) => `${t.hammerThresholdMinor}+ → ${t.rate}`).join("; ")})`;
  }
  return `${sale.buyerPremiumRate} flat rate`;
}

const registrationStatusLabel: Record<AdminSaleRegistrationRow["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export default async function AdminSaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getAdminSaleById(id);
  if (!bundle) notFound();
  const { sale, lots } = bundle;

  let draftOrphans = await getAdminLotList({ status: "draft", limit: 100, offset: 0 });
  draftOrphans = draftOrphans.filter((l) => l.saleId == null);

  const [saleDocuments, registrations] = await Promise.all([
    getServerSaleDocuments(id).catch(() => []),
    sale.status === "scheduled" || sale.status === "active"
      ? getAdminSaleRegistrations(id).catch(() => [])
      : Promise.resolve([] as AdminSaleRegistrationRow[]),
  ]);

  const canEdit = sale.status === "draft";
  const canPublish = sale.status === "draft";
  const canUnpublish = sale.status === "scheduled";
  const canCancel =
    sale.status === "draft" || sale.status === "scheduled" || sale.status === "active";
  const isOnsite = sale.deliveryMode === "onsite";
  const canMarkOnsiteEnded = isOnsite && (sale.status === "active" || sale.status === "scheduled");
  const liveish = sale.status === "scheduled" || sale.status === "active";

  const venueLines = [
    sale.locationName,
    [sale.locationAddressLine1, sale.locationAddressLine2].filter(Boolean).join(", ") || null,
    [sale.locationCity, sale.locationCounty, sale.locationPostcode].filter(Boolean).join(", ") ||
      null,
    sale.locationCountry,
    sale.locationAddress,
  ].filter(Boolean) as string[];

  return (
    <AdminEntityDetailShell
      className="space-y-8"
      breadcrumbs={
        <Link
          href="/admin/sales"
          className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
        >
          ← Sales
        </Link>
      }
      title={sale.title}
      description={
        sale.description
          ? sale.description.length > 280
            ? `${sale.description.slice(0, 280)}…`
            : sale.description
          : undefined
      }
      meta={
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge variant={saleStatusToBadgeVariant(sale.status)}>
            {saleStatusLabel[sale.status] ?? sale.status}
          </StatusBadge>
          <span className="font-label text-xs uppercase tracking-widest text-secondary">
            {sale.deliveryMode} · {lots.length} lot{lots.length === 1 ? "" : "s"}
          </span>
        </div>
      }
      actions={
        <AdminSaleHeaderActions
          saleId={id}
          saleTitle={sale.title}
          canEdit={canEdit}
          canPublish={canPublish}
          canUnpublish={canUnpublish}
          canCancel={canCancel}
          canMarkOnsiteEnded={canMarkOnsiteEnded}
        />
      }
    >
      <Tabs defaultValue="overview">
        <TabsList className="mb-6 flex flex-wrap gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="lots">Lots {lots.length > 0 ? `(${lots.length})` : ""}</TabsTrigger>
          <TabsTrigger value="documents">
            Documents {saleDocuments.length > 0 ? `(${saleDocuments.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="registrations">
            Registrations{" "}
            {registrations.length > 0 ? `(${registrations.length})` : liveish ? "(0)" : ""}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoCard title="Status">
              <StatusBadge variant={saleStatusToBadgeVariant(sale.status)}>
                {saleStatusLabel[sale.status] ?? sale.status}
              </StatusBadge>
            </InfoCard>
            <InfoCard title="Delivery">
              <span className="capitalize">{sale.deliveryMode}</span>
              {sale.streamUrl ? (
                <p className="mt-2 font-mono text-xs break-all text-on-surface-variant">
                  Stream: {sale.streamUrl}
                </p>
              ) : null}
            </InfoCard>
            <InfoCard title="Buyer premium">
              <p className="font-body text-sm text-on-surface">{buyerPremiumSummary(sale)}</p>
            </InfoCard>
            <InfoCard title="Lots & hammer">
              <p className="font-body text-sm">
                <span className="font-medium text-on-surface">{lots.length}</span> lot
                {lots.length === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Aggregate current hammer (sum of lot current prices):{" "}
                <span className="tabular-nums font-medium text-on-surface">
                  {sumLotHammers(lots)}
                </span>
              </p>
            </InfoCard>
            {isOnsite && venueLines.length > 0 ? (
              <InfoCard title="Venue" className="sm:col-span-2">
                <ul className="list-inside list-disc space-y-1 font-body text-sm text-on-surface-variant">
                  {venueLines.map((line, i) => (
                    <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
                  ))}
                </ul>
                {sale.locationMapUrl ? (
                  <p className="mt-2">
                    <Link
                      href={sale.locationMapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
                    >
                      Open map ↗
                    </Link>
                  </p>
                ) : null}
              </InfoCard>
            ) : null}
            {liveish ? (
              <InfoCard title="Saleroom & registrations" className="sm:col-span-2">
                <div className="flex flex-wrap gap-3">
                  <Button size="sm" asChild>
                    <Link href={`/admin/saleroom/${id}`}>Open saleroom</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/sales/${id}/registrations`}>
                      {isOnsite ? "Paddle registrations" : "Bidder registrations"}
                    </Link>
                  </Button>
                </div>
              </InfoCard>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="schedule">
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoCard title="Sale window">
              <dl className="space-y-2 font-body text-sm">
                <div>
                  <dt className="font-label text-[10px] uppercase tracking-widest text-secondary">
                    Start
                  </dt>
                  <dd className="tabular-nums text-on-surface">
                    {sale.startTime.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="font-label text-[10px] uppercase tracking-widest text-secondary">
                    End
                  </dt>
                  <dd className="tabular-nums text-on-surface">{sale.endTime.toLocaleString()}</dd>
                </div>
                {sale.previewStartTime ? (
                  <div>
                    <dt className="font-label text-[10px] uppercase tracking-widest text-secondary">
                      Preview from
                    </dt>
                    <dd className="tabular-nums text-on-surface">
                      {sale.previewStartTime.toLocaleString()}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-3 text-xs text-on-surface-variant">
                Displayed in your browser locale. Cross-check with published catalog copy for the
                canonical timezone.
              </p>
            </InfoCard>
            <InfoCard title="Per-lot timing">
              <p className="font-body text-sm text-on-surface-variant">
                {sale.deliveryMode === "onsite"
                  ? "Onsite lots typically share the sale window above. Open a lot to adjust its own schedule if needed."
                  : "Each online lot has its own start/end. Open the Lots tab to jump to a lot, then edit its schedule on the lot detail page."}
              </p>
            </InfoCard>
          </div>
        </TabsContent>

        <TabsContent value="lots">
          <SaleLotsTabSection
            saleId={id}
            saleStatus={sale.status}
            deliveryMode={sale.deliveryMode}
            canEdit={canEdit}
            lots={lots.map((l) => ({
              id: l.id,
              title: l.title,
              lotNumber: l.lotNumber,
              status: l.status,
            }))}
            draftOrphans={draftOrphans.map((l) => ({ id: l.id, title: l.title }))}
          />
        </TabsContent>

        <TabsContent value="documents">
          <SaleDocumentsSection saleId={id} initialDocuments={saleDocuments} />
        </TabsContent>

        <TabsContent value="registrations">
          {liveish ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-body text-sm text-on-surface-variant">
                  {registrations.length} registration{registrations.length === 1 ? "" : "s"} loaded.
                  Use the full queue for filters, reject reasons, and pagination.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/sales/${id}/registrations`}>Open registrations page</Link>
                </Button>
              </div>
              {registrations.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No registrations yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-outline-variant/20">
                  <table className="w-full min-w-[36rem] font-body text-sm">
                    <thead>
                      <tr className="border-b border-outline-variant/20 bg-surface-container-low/40">
                        <th className="px-3 py-2 text-left font-label text-[10px] uppercase tracking-widest text-secondary">
                          Bidder
                        </th>
                        <th className="px-3 py-2 text-left font-label text-[10px] uppercase tracking-widest text-secondary">
                          Status
                        </th>
                        <th className="px-3 py-2 text-left font-label text-[10px] uppercase tracking-widest text-secondary">
                          Requested
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrations.slice(0, 50).map((r) => (
                        <tr key={r.id} className="border-b border-outline-variant/10 last:border-0">
                          <td className="px-3 py-2">
                            <span className="font-medium text-on-surface">
                              {r.buyerLegalEntityDisplayName ?? r.userName ?? r.userEmail ?? "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-on-surface-variant">
                            {registrationStatusLabel[r.status]}
                          </td>
                          <td className="px-3 py-2 text-xs text-on-surface-variant tabular-nums">
                            {r.requestedAt ? new Date(r.requestedAt).toLocaleString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <p className="font-body text-sm text-on-surface-variant">
              Registrations open when the sale is scheduled or live. Current status:{" "}
              <strong>{saleStatusLabel[sale.status]}</strong>.
            </p>
          )}
        </TabsContent>

        <TabsContent value="activity">
          <div className="space-y-3">
            <p className="font-body text-sm text-on-surface-variant">
              Domain events for aggregate <span className="font-mono">sale / {id}</span>.
            </p>
            <Link
              href={`/admin/audit/timeline?aggregateType=sale&aggregateId=${id}`}
              className="inline-flex items-center gap-1 font-label text-xs uppercase tracking-widest text-primary hover:underline"
            >
              Open audit timeline ↗
            </Link>
          </div>
        </TabsContent>
      </Tabs>
    </AdminEntityDetailShell>
  );
}

function InfoCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`border-outline-variant/15 bg-surface-container-low/30 ${className ?? ""}`}>
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="font-label text-[10px] uppercase tracking-widest text-secondary">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">{children}</CardContent>
    </Card>
  );
}
