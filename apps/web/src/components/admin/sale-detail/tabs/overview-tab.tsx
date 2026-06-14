"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  CatalogDetailSection,
  CatalogDetailSummaryStrip,
  CatalogExternalLink,
  CatalogInfoCard,
} from "@/components/admin/catalog";
import { CatalogDeleteEligibilityNotice } from "@/components/admin/catalog/catalog-delete-eligibility-notice";
import {
  buyerPremiumSummary,
  sumLotHammers,
} from "@/components/admin/sale-detail/sale-detail-helpers";
import { useSaleDetailReadiness } from "@/components/admin/sale-detail/sale-detail-readiness-context";
import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import { buildSaleSummaryItems } from "@/lib/admin/build-sale-summary-items";
import { buildSalePublishReadiness } from "@/lib/admin/catalog-readiness";
import type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness";
import { saleSetupResumeHref } from "@/lib/admin/sale-setup";
import { formatDateTime } from "@/lib/ui/format";
import type { Lot, Sale } from "@auction/types";
import Link from "next/link";

type Props = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  liveish: boolean;
  isSaleroom: boolean;
  venueLines: string[];
  registrationCount: number | null;
  pendingRegistrationCount?: number | null;
  connectRequiredByLotId?: ConnectRequiredByLotId;
};

export function SaleOverviewTab({
  saleId,
  sale,
  lots,
  liveish,
  isSaleroom,
  venueLines,
  registrationCount,
  pendingRegistrationCount = null,
  connectRequiredByLotId,
}: Props) {
  const readinessContext = useSaleDetailReadiness();
  const summaryItems = buildSaleSummaryItems(
    saleId,
    sale,
    lots.length,
    sumLotHammers(lots),
    liveish,
    registrationCount,
  );

  const readiness =
    sale.status === "draft"
      ? (readinessContext?.draftSetupReadiness ?? null)
      : sale.status === "scheduled"
        ? buildSalePublishReadiness(saleId, sale, lots.length, pendingRegistrationCount)
        : null;

  const showContinueSetup = sale.status === "draft" && readiness && readiness.percent < 100;
  const showDeleteBlockers =
    readinessContext?.canManageSales &&
    (sale.status === "draft" || sale.status === "scheduled") &&
    (readinessContext.deleteBlockers?.length ?? 0) > 0;

  return (
    <div className="space-y-8">
      {showDeleteBlockers ? (
        <CatalogDeleteEligibilityNotice
          blockers={readinessContext?.deleteBlockers ?? []}
          entityLabel="sale"
        />
      ) : null}
      {showContinueSetup ? (
        <Link
          href={saleSetupResumeHref(saleId, {
            sale,
            lots,
            pendingRegistrationCount,
            ...(connectRequiredByLotId ? { connectRequiredByLotId } : {}),
          })}
          className="block rounded-xl border border-primary/30 bg-primary/5 p-5 transition-colors hover:bg-primary/10"
        >
          <h3 className="font-headline text-base text-on-surface">Continue sale setup</h3>
          <p className="mt-2 font-body text-sm text-on-surface-variant">
            {readiness?.completeCount ?? 0} of {readiness?.totalCount ?? 0} checks complete — finish
            setup to publish.
          </p>
          <span className="mt-3 inline-block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Continue setup →
          </span>
        </Link>
      ) : null}

      <CatalogDetailSummaryStrip items={summaryItems} />

      <CatalogDetailSection
        title="Status & delivery"
        description="How this sale is published and delivered to bidders."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CatalogInfoCard title="Status">
            <AdminStatusBadge domain="sale" status={sale.status} />
          </CatalogInfoCard>
          <CatalogInfoCard title="Delivery">
            <span className="capitalize">{sale.deliveryMode}</span>
            {sale.streamUrl ? (
              <p className="mt-2 font-body text-xs text-on-surface-variant">
                Stream: <CatalogExternalLink href={sale.streamUrl} className="text-xs" />
              </p>
            ) : null}
          </CatalogInfoCard>
        </div>
      </CatalogDetailSection>

      <CatalogDetailSection title="Commercial" description="Buyer premium and lot performance.">
        <div className="grid gap-4 sm:grid-cols-2">
          <CatalogInfoCard title="Buyer premium">
            <p className="font-body text-sm text-on-surface">{buyerPremiumSummary(sale)}</p>
          </CatalogInfoCard>
          <CatalogInfoCard title="Lots & hammer">
            <p className="font-body text-sm">
              <span className="font-medium text-on-surface">{lots.length}</span> lot
              {lots.length === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Aggregate current hammer:{" "}
              <span className="font-medium tabular-nums text-on-surface">
                {sumLotHammers(lots)}
              </span>
            </p>
            <Link
              href={saleDetailTabHref(saleId, "lots")}
              className="mt-2 inline-block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
            >
              Manage lots →
            </Link>
          </CatalogInfoCard>
        </div>
      </CatalogDetailSection>

      <CatalogDetailSection
        title="Schedule"
        description="Sale window and preview timing. See the Schedule tab for per-lot details."
      >
        <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6">
          <dl className="grid gap-4 sm:grid-cols-2 font-body text-sm">
            <div>
              <dt className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                Start
              </dt>
              <dd className="mt-1 tabular-nums text-on-surface">
                {formatDateTime(sale.startTime)}
              </dd>
            </div>
            <div>
              <dt className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                End
              </dt>
              <dd className="mt-1 tabular-nums text-on-surface">{formatDateTime(sale.endTime)}</dd>
            </div>
            {sale.previewStartTime ? (
              <div>
                <dt className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                  Preview from
                </dt>
                <dd className="mt-1 tabular-nums text-on-surface">
                  {formatDateTime(sale.previewStartTime)}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-4 text-xs text-on-surface-variant">
            Displayed in your browser locale. Cross-check published catalog copy for the canonical
            timezone.{" "}
            <Link
              href={saleDetailTabHref(saleId, "schedule")}
              className="text-link hover:underline"
            >
              Full schedule →
            </Link>
          </p>
        </div>
      </CatalogDetailSection>

      {isSaleroom && venueLines.length > 0 ? (
        <CatalogDetailSection title="Venue" description="Saleroom location for this sale.">
          <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6">
            <ul className="list-inside list-disc space-y-1 font-body text-sm text-on-surface-variant">
              {venueLines.map((line, i) => (
                <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
              ))}
            </ul>
            {sale.locationMapUrl ? (
              <p className="mt-3">
                <CatalogExternalLink
                  href={sale.locationMapUrl}
                  className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
                >
                  Open map
                </CatalogExternalLink>
              </p>
            ) : null}
          </div>
        </CatalogDetailSection>
      ) : null}

      {liveish ? (
        <CatalogDetailSection
          title="Operations"
          description="Registrations and saleroom access for live sale management."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ActionCard
              title="Open saleroom"
              description="Run the live auction from the saleroom console."
              href={`/admin/saleroom/${saleId}`}
              cta="Open saleroom →"
            />
            <ActionCard
              title={isSaleroom ? "Paddle registrations" : "Bidder registrations"}
              description={
                registrationCount != null && registrationCount > 0
                  ? `${registrationCount} registration${registrationCount === 1 ? "" : "s"} on file.`
                  : "No registrations yet — review before going live."
              }
              href={saleDetailTabHref(saleId, "registrations")}
              cta="Review registrations →"
            />
          </div>
        </CatalogDetailSection>
      ) : null}
    </div>
  );
}

function ActionCard({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-border-hairline bg-surface-container-low/40 p-5 transition-colors hover:border-link/30 hover:bg-primary/5"
    >
      <h3 className="font-headline text-base text-on-surface">{title}</h3>
      <p className="mt-2 font-body text-sm text-on-surface-variant">{description}</p>
      <span className="mt-3 inline-block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        {cta}
      </span>
    </Link>
  );
}
