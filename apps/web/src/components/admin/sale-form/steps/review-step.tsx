"use client";

import { CatalogPublishReadiness } from "@/components/admin/catalog/catalog-publish-readiness";
import { buyerPremiumSummary } from "@/components/admin/sale-detail/sale-detail-helpers";
import {
  buildSaleSetupReadiness,
  draftSaleLotPublishBanner,
  publishBlockedCatalogueRoleMessage,
  saleSetupHref,
} from "@/lib/admin/sale-setup";
import { formatDateTime } from "@/lib/ui/format";
import type { Lot, Sale } from "@auction/types";
import { Alert, AlertDescription } from "@auction/ui/components/alert";

type Props = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  pendingRegistrationCount?: number | null;
  canPublish: boolean;
};

export function SaleSetupReviewStep({
  saleId,
  sale,
  lots,
  pendingRegistrationCount = null,
  canPublish,
}: Props) {
  const readiness = buildSaleSetupReadiness({
    saleId,
    sale,
    lots,
    pendingRegistrationCount,
    setupStepHref: (step) => saleSetupHref(saleId, step),
  });

  return (
    <div className="space-y-8">
      <Alert>
        <AlertDescription>{draftSaleLotPublishBanner()}</AlertDescription>
      </Alert>

      {!canPublish ? (
        <Alert>
          <AlertDescription>{publishBlockedCatalogueRoleMessage()}</AlertDescription>
        </Alert>
      ) : null}

      <CatalogPublishReadiness
        title="Ready to go live?"
        readiness={readiness}
        dismissKey={`setup-review:${saleId}`}
      />

      <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6">
        <dl className="grid gap-4 sm:grid-cols-2 font-body text-sm">
          <div>
            <dt className="font-label text-[10px] uppercase tracking-wide text-secondary">Sale</dt>
            <dd className="mt-1 text-on-surface">{sale.title}</dd>
          </div>
          <div>
            <dt className="font-label text-[10px] uppercase tracking-wide text-secondary">
              Delivery
            </dt>
            <dd className="mt-1 capitalize text-on-surface">{sale.deliveryMode}</dd>
          </div>
          <div>
            <dt className="font-label text-[10px] uppercase tracking-wide text-secondary">Opens</dt>
            <dd className="mt-1 tabular-nums text-on-surface">{formatDateTime(sale.startTime)}</dd>
          </div>
          <div>
            <dt className="font-label text-[10px] uppercase tracking-wide text-secondary">
              Closes
            </dt>
            <dd className="mt-1 tabular-nums text-on-surface">{formatDateTime(sale.endTime)}</dd>
          </div>
          <div>
            <dt className="font-label text-[10px] uppercase tracking-wide text-secondary">Lots</dt>
            <dd className="mt-1 tabular-nums text-on-surface">{lots.length}</dd>
          </div>
          <div>
            <dt className="font-label text-[10px] uppercase tracking-wide text-secondary">
              Buyer premium
            </dt>
            <dd className="mt-1 text-on-surface">{buyerPremiumSummary(sale)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export function isSaleSetupReadyToPublish(
  saleId: string,
  sale: Sale,
  lots: Lot[],
  pendingRegistrationCount: number | null = null,
): boolean {
  const readiness = buildSaleSetupReadiness({
    saleId,
    sale,
    lots,
    pendingRegistrationCount,
  });
  return readiness.percent === 100;
}
