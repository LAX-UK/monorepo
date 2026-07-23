"use client";

import {
  WizardFormReviewSection,
  WizardReviewRow,
} from "@/components/admin/admin-form-wizard/wizard-form-review-section";
import { buyerPremiumSummary } from "@/components/admin/sale-detail/sale-detail-helpers";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness-shared";
import {
  buildSaleSetupReadiness,
  draftSaleLotPublishBanner,
  isSaleSetupPublishReady,
  publishBlockedCatalogueRoleMessage,
  reviewSaveDraftHint,
  saleSetupHref,
} from "@/lib/admin/sale-setup";
import { deliveryModeLabel } from "@/lib/admin/sale-setup/field-copy";
import { formatDateTime } from "@/lib/ui/format";
import type { Lot, Sale } from "@auction/types";
import { cn } from "@auction/ui";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Circle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  pendingRegistrationCount?: number | null;
  canPublish: boolean;
  connectRequiredByLotId?: ConnectRequiredByLotId;
  onEditSummary?: () => void;
  documentCount?: number;
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

function ReviewSummaryCard({
  title,
  stepHref,
  children,
}: {
  title: string;
  stepHref: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-outline-variant/25 bg-surface-container-lowest/40">
      <div className="flex items-center justify-between gap-3 border-b border-border-hairline px-4 py-3">
        <h3 className="font-display text-base font-semibold tracking-tight text-on-surface">
          {title}
        </h3>
        <Link
          href={stepHref}
          className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
        >
          Edit
        </Link>
      </div>
      <dl className="space-y-2 px-4 py-4 font-body text-sm">{children}</dl>
    </section>
  );
}

function ReviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="text-right font-medium text-on-surface">{value}</dd>
    </div>
  );
}

export function SaleSetupReviewStep({
  saleId,
  sale,
  lots,
  pendingRegistrationCount = null,
  canPublish,
  connectRequiredByLotId,
  onEditSummary,
  documentCount = 0,
}: Props) {
  const readiness = buildSaleSetupReadiness({
    saleId,
    sale,
    lots,
    pendingRegistrationCount,
    ...(connectRequiredByLotId ? { connectRequiredByLotId } : {}),
    setupStepHref: (step) => saleSetupHref(saleId, step),
  });

  const termsFilled = Boolean(sale.terms?.trim());

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

      <div className="grid gap-4 lg:grid-cols-2">
        <ReviewSummaryCard title="Sale details" stepHref={saleSetupHref(saleId, "identity")}>
          <ReviewFact label="Title" value={sale.title} />
          <ReviewFact label="Description" value={sale.description?.trim() ? "Added" : "Not set"} />
        </ReviewSummaryCard>

        <ReviewSummaryCard title="Schedule" stepHref={saleSetupHref(saleId, "schedule")}>
          <ReviewFact label="Format" value={deliveryModeLabel(sale.deliveryMode)} />
          <ReviewFact label="Opens" value={formatDateTime(sale.startTime)} />
          <ReviewFact label="Closes" value={formatDateTime(sale.endTime)} />
          <ReviewFact label="Buyer premium" value={buyerPremiumSummary(sale)} />
        </ReviewSummaryCard>

        <ReviewSummaryCard title="Documents" stepHref={saleSetupHref(saleId, "documents")}>
          <ReviewFact label="Attachments" value={String(documentCount)} />
          <ReviewFact label="Terms of sale" value={termsFilled ? "Added" : "Not set"} />
        </ReviewSummaryCard>

        <ReviewSummaryCard title="Lots" stepHref={saleSetupHref(saleId, "lots")}>
          <ReviewFact label="Lots in sale" value={String(lots.length)} />
          <ReviewFact
            label="Published lots"
            value={String(lots.filter((l) => l.status !== "draft").length)}
          />
        </ReviewSummaryCard>
      </div>

      <WizardFormReviewSection title="Full summary" onEdit={() => onEditSummary?.()}>
        <WizardReviewRow label="Sale" value={sale.title} />
        <WizardReviewRow label="Delivery" value={sale.deliveryMode} />
        <WizardReviewRow label="Opens" value={formatDateTime(sale.startTime)} />
        <WizardReviewRow label="Closes" value={formatDateTime(sale.endTime)} />
        <WizardReviewRow label="Lots" value={String(lots.length)} />
        <WizardReviewRow label="Buyer premium" value={buyerPremiumSummary(sale)} />
      </WizardFormReviewSection>
    </div>
  );
}

export function isSaleSetupReadyToPublish(
  saleId: string,
  sale: Sale,
  lots: Lot[],
  pendingRegistrationCount: number | null = null,
  connectRequiredByLotId?: ConnectRequiredByLotId,
): boolean {
  return isSaleSetupPublishReady({
    saleId,
    sale,
    lots,
    pendingRegistrationCount,
    ...(connectRequiredByLotId ? { connectRequiredByLotId } : {}),
  });
}
