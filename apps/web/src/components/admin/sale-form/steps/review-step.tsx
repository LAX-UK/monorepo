"use client";

import { buyerPremiumSummary } from "@/components/admin/sale-detail/sale-detail-helpers";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import {
  buildSaleSetupReadiness,
  draftSaleLotPublishBanner,
  isSaleSetupPublishReady,
  publishBlockedCatalogueRoleMessage,
  reviewSaveDraftHint,
  saleSetupHref,
} from "@/lib/admin/sale-setup";
import { formatDateTime } from "@/lib/ui/format";
import type { Lot, Sale } from "@auction/types";
import { cn } from "@auction/ui";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Circle } from "lucide-react";
import Link from "next/link";

type Props = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  pendingRegistrationCount?: number | null;
  canPublish: boolean;
};

function SetupReviewBeforePublish({
  readiness,
}: {
  readiness: CatalogReadinessResult;
}) {
  if (readiness.percent === 100) {
    return (
      <p className="font-body text-sm text-positive">All checks complete. Ready to go live.</p>
    );
  }

  const failing = readiness.items.filter((item) => !item.ok);
  return (
    <div className="space-y-3 rounded-xl border border-border-hairline bg-surface-container-low/40 p-5">
      <p className="font-body text-sm text-on-surface-variant">{reviewSaveDraftHint()}</p>
      <div>
        <h3 className="font-label text-[10px] uppercase tracking-wide text-secondary">
          Before you publish
        </h3>
        <ul className="mt-2 space-y-1.5">
          {failing.map((item) => (
            <li key={item.id}>
              {item.href ? (
                <Link
                  href={item.href}
                  className="flex items-start gap-2 text-sm text-on-surface hover:underline"
                >
                  <Circle
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      item.severity === "required" ? "text-danger" : "text-warning",
                    )}
                    aria-hidden
                  />
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span className="flex items-start gap-2 text-sm text-on-surface">
                  <Circle
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      item.severity === "required" ? "text-danger" : "text-warning",
                    )}
                    aria-hidden
                  />
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

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

      <SetupReviewBeforePublish readiness={readiness} />

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
  return isSaleSetupPublishReady({
    saleId,
    sale,
    lots,
    pendingRegistrationCount,
  });
}
