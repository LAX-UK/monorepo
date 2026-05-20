import { TabbedQueueSkeleton } from "@/components/admin/admin-loading-skeletons";
import { AdminPinPageButton } from "@/components/admin/admin-pin-page-button";
import { AdminSaleHeaderActions } from "@/components/admin/admin-sale-header-actions";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  CatalogDetailShell,
  CatalogInfoAside,
  type CatalogMobileAction,
  CatalogTabPanel,
  type CatalogTabPanelItem,
} from "@/components/admin/catalog";
import { AdminSaleEditableTitle } from "@/components/admin/editable-titles";
import { SaleDocumentsSection } from "@/components/admin/sale-form/sale-documents-section";
import { SaleLotsTabSection } from "@/components/admin/sale-lots-tab-section";
import { SaleRegistrationsTabSection } from "@/components/admin/sale-registrations-tab-section";
import {
  type AdminSaleRegistrationRow,
  getAdminLotList,
  getAdminSaleById,
  getAdminSaleRegistrations,
} from "@/lib/data/http/admin.server";
import { getServerSaleDocuments } from "@/lib/data/http/sale-documents.server";
import { salePath } from "@/lib/seo/url";
import { formatDateTime, formatNumber } from "@/lib/ui/format";
import type { Lot, Sale } from "@auction/types";
import { Button } from "@auction/ui";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

const SALE_DETAIL_TABS = ["overview", "schedule", "lots", "documents", "registrations"] as const;

type SaleDetailTab = (typeof SALE_DETAIL_TABS)[number];

function parseSaleDetailTab(raw: string | undefined): SaleDetailTab | undefined {
  if (raw && SALE_DETAIL_TABS.includes(raw as SaleDetailTab)) {
    return raw as SaleDetailTab;
  }
  return undefined;
}

function prefersRegistrationsDefault(sale: Sale): boolean {
  if (sale.status === "scheduled") return true;
  if (sale.status === "active" && sale.deliveryMode === "online") return true;
  return false;
}

function sumLotHammers(lots: Lot[]): string {
  let total = 0;
  for (const l of lots) {
    const n = Number.parseFloat(String(l.currentPrice ?? "0"));
    if (!Number.isNaN(n)) total += n;
  }
  return formatNumber(total, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function buyerPremiumSummary(sale: Sale): string {
  const tiers = sale.buyerPremiumTiers;
  if (tiers && tiers.length > 0) {
    return `${tiers.length} tier${tiers.length === 1 ? "" : "s"} (${tiers.map((t) => `${t.hammerThresholdMinor}+ → ${t.rate}`).join("; ")})`;
  }
  return `${sale.buyerPremiumRate} flat rate`;
}

export default async function AdminSaleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const actionError = sp.error ? decodeURIComponent(sp.error) : null;

  const bundle = await getAdminSaleById(id);
  if (!bundle) notFound();
  const { sale, lots } = bundle;

  const activeTab =
    parseSaleDetailTab(sp.tab) ??
    (prefersRegistrationsDefault(sale) ? "registrations" : "overview");

  let draftOrphans = await getAdminLotList({ status: "draft", limit: 100, offset: 0 });
  draftOrphans = draftOrphans.filter((l) => l.saleId == null);

  const liveish = sale.status === "scheduled" || sale.status === "active";
  let registrations: AdminSaleRegistrationRow[] = [];
  let registrationsError: string | null = null;

  const [saleDocuments, registrationsResult] = await Promise.all([
    getServerSaleDocuments(id).catch(() => []),
    liveish
      ? getAdminSaleRegistrations(id)
          .then((rows) => ({ rows, error: null as string | null }))
          .catch((err) => ({
            rows: [] as AdminSaleRegistrationRow[],
            error: err instanceof Error ? err.message : "Failed to load registrations.",
          }))
      : Promise.resolve({ rows: [] as AdminSaleRegistrationRow[], error: null as string | null }),
  ]);
  registrations = registrationsResult.rows;
  registrationsError = registrationsResult.error;

  const canEdit = sale.status === "draft";
  const canPublish = sale.status === "draft";
  const canUnpublish = sale.status === "scheduled";
  const canCancel =
    sale.status === "draft" || sale.status === "scheduled" || sale.status === "active";
  const isOnsite = sale.deliveryMode === "onsite";
  const canMarkOnsiteEnded = isOnsite && (sale.status === "active" || sale.status === "scheduled");

  const venueLines = [
    sale.locationName,
    [sale.locationAddressLine1, sale.locationAddressLine2].filter(Boolean).join(", ") || null,
    [sale.locationCity, sale.locationCounty, sale.locationPostcode].filter(Boolean).join(", ") ||
      null,
    sale.locationCountry,
    sale.locationAddress,
  ].filter(Boolean) as string[];

  const publicHref = salePath({ id: sale.id, title: sale.title });

  const mobileActions: CatalogMobileAction[] = [];
  if (liveish) {
    mobileActions.push({
      id: "saleroom",
      label: "Open saleroom",
      href: `/admin/saleroom/${id}`,
      variant: "primary",
    });
  }
  mobileActions.push({
    id: "edit",
    label: canEdit ? "Edit draft" : "Edit details",
    href: `/admin/sales/${id}/edit`,
    variant: liveish ? "secondary" : "primary",
  });
  mobileActions.push({
    id: "site",
    label: "View on site",
    href: publicHref,
  });

  const tabItems: CatalogTabPanelItem[] = [
    {
      value: "overview",
      label: "Overview",
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard title="Status">
            <AdminStatusBadge domain="sale" status={sale.status} />
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
                    className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
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
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/sales/${id}?tab=registrations`}>
                    {isOnsite ? "Paddle registrations" : "Bidder registrations"}
                  </Link>
                </Button>
              </div>
            </InfoCard>
          ) : null}
        </div>
      ),
    },
    {
      value: "schedule",
      label: "Schedule",
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard title="Sale window">
            <dl className="space-y-2 font-body text-sm">
              <div>
                <dt className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                  Start
                </dt>
                <dd className="tabular-nums text-on-surface">{formatDateTime(sale.startTime)}</dd>
              </div>
              <div>
                <dt className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                  End
                </dt>
                <dd className="tabular-nums text-on-surface">{formatDateTime(sale.endTime)}</dd>
              </div>
              {sale.previewStartTime ? (
                <div>
                  <dt className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                    Preview from
                  </dt>
                  <dd className="tabular-nums text-on-surface">
                    {formatDateTime(sale.previewStartTime)}
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
      ),
    },
    {
      value: "lots",
      label: `Lots${lots.length > 0 ? ` (${lots.length})` : ""}`,
      content: (
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
      ),
    },
    {
      value: "documents",
      label: `Documents${saleDocuments.length > 0 ? ` (${saleDocuments.length})` : ""}`,
      content: <SaleDocumentsSection saleId={id} initialDocuments={saleDocuments} />,
    },
    {
      value: "registrations",
      label: `Registrations${
        registrations.length > 0 ? ` (${registrations.length})` : liveish ? " (0)" : ""
      }`,
      content: (
        <SaleRegistrationsTabSection
          saleId={id}
          saleStatus={sale.status}
          liveish={liveish}
          rows={registrations}
          fetchError={registrationsError}
          actionError={actionError}
        />
      ),
    },
  ];

  return (
    <CatalogDetailShell
      breadcrumbs={
        <Link href="/admin/sales" className="text-primary hover:underline">
          ← Sales
        </Link>
      }
      eyebrow="Sale"
      className="space-y-6"
      title={<AdminSaleEditableTitle saleId={id} value={sale.title} />}
      description={
        sale.description
          ? sale.description.length > 280
            ? `${sale.description.slice(0, 280)}…`
            : sale.description
          : undefined
      }
      meta={
        <div className="flex flex-wrap items-center gap-2">
          <AdminStatusBadge domain="sale" status={sale.status} />
          <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            {sale.deliveryMode} · {lots.length} lot{lots.length === 1 ? "" : "s"}
          </span>
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <AdminPinPageButton label={sale.title} />
          <AdminSaleHeaderActions
            saleId={id}
            saleTitle={sale.title}
            canEdit={canEdit}
            canPublish={canPublish}
            canUnpublish={canUnpublish}
            canCancel={canCancel}
            canMarkOnsiteEnded={canMarkOnsiteEnded}
            showSaleroomLink={liveish}
          />
        </div>
      }
      mobileActions={mobileActions}
      aside={
        <CatalogInfoAside
          entityId={id}
          updatedAt={sale.updatedAt}
          publicHref={publicHref}
          publicLabel="View on site"
          status={<AdminStatusBadge domain="sale" status={sale.status} />}
        />
      }
      tabs={
        <Suspense fallback={<TabbedQueueSkeleton />}>
          <CatalogTabPanel defaultValue={activeTab} syncUrl tabs={tabItems} />
        </Suspense>
      }
    >
      {null}
    </CatalogDetailShell>
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
    <Surface
      variant="section"
      padding="md"
      className={`border-border-hairline bg-surface-container-low/30 ${className ?? ""}`}
    >
      <h3 className="pb-2 font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        {title}
      </h3>
      <div className="pb-4">{children}</div>
    </Surface>
  );
}
