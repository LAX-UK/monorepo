"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
import { SofCaseAuditTrail } from "@/components/admin/compliance-sof-board/sof-case-audit-trail";
import { SofEvidenceList } from "@/components/admin/compliance-sof-board/sof-evidence-list";
import { SofMakerCheckerBanner } from "@/components/admin/compliance-sof-board/sof-maker-checker-banner";
import { SofSettlementBreakdown } from "@/components/admin/compliance-sof-board/sof-settlement-breakdown";
import {
  ComplianceDecideForm,
  ComplianceTriageForm,
} from "@/components/admin/compliance/compliance-review-forms";
import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  row: AdminSofTableRow;
  detail: AdminSourceOfFundsDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  onRetryDetail: () => void;
  canTriage: boolean;
  canDecide: boolean;
  currentUserId: string;
};

export function SofDrawerContent({
  row,
  detail,
  detailLoading,
  detailError,
  onRetryDetail,
  canTriage,
  canDecide,
  currentUserId,
}: Props) {
  const buyerLabel = detail?.buyer.label ?? row.buyerLabel;

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/admin/clients/${row.userId}`}
          className="font-headline text-base text-link hover:underline"
        >
          {buyerLabel}
        </Link>
        {detail?.buyer.email && detail.buyer.email !== buyerLabel ? (
          <p className="text-sm text-on-surface-variant">{detail.buyer.email}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <AdminStatusBadge domain="sofCase" status={row.displayStatus} size="sm" />
          <span className="text-sm text-on-surface-variant">Opened {row.openedLabel}</span>
        </div>
      </div>

      <Alert>
        <AlertTitle>Buyer-scoped gate</AlertTitle>
        <AlertDescription>
          This case applies to the buyer&apos;s entire settlement profile, not a single lot. All
          checkout and settlement for this buyer remains blocked until MLRO approves.
        </AlertDescription>
      </Alert>

      {row.pendingCasesForBuyer > 1 ? (
        <Alert>
          <AlertTitle>Multiple pending cases</AlertTitle>
          <AlertDescription>
            This buyer has {row.pendingCasesForBuyer} pending Source of Funds cases. Review each
            case separately; legacy duplicates may exist.
          </AlertDescription>
        </Alert>
      ) : null}

      <SofMakerCheckerBanner
        row={row}
        canTriage={canTriage}
        canDecide={canDecide}
        currentUserId={currentUserId}
      />

      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Trigger</dt>
          <dd>{row.triggerLabel}</dd>
          {row.triggerExplanation ? (
            <dd className="mt-1 text-on-surface-variant">{row.triggerExplanation}</dd>
          ) : null}
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Threshold</dt>
          <dd>{row.thresholdLabel}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">
            Exposure at case open
          </dt>
          <dd>{row.exposureLabel}</dd>
        </div>
      </dl>

      <section className="space-y-2">
        <h4 className="font-label text-[10px] uppercase text-on-surface-variant">
          Settlement exposure
        </h4>
        {detailLoading ? (
          <p className="font-body text-sm text-on-surface-variant">Loading settlement breakdown…</p>
        ) : detailError ? (
          <div className="space-y-2">
            <Alert variant="destructive">
              <AlertTitle>Could not load detail</AlertTitle>
              <AlertDescription>{detailError}</AlertDescription>
            </Alert>
            <Button type="button" variant="outline" size="sm" onClick={onRetryDetail}>
              Retry
            </Button>
          </div>
        ) : detail ? (
          <>
            <SofSettlementBreakdown detail={detail} />
            {detail.blockedPayments.length > 0 ? (
              <p className="font-body text-sm">
                <Link href="/admin/payments" className="text-link underline">
                  {detail.blockedPayments.length} payment
                  {detail.blockedPayments.length === 1 ? "" : "s"} in manual review
                </Link>
                {" · "}
                Finance queue
              </p>
            ) : null}
          </>
        ) : null}
      </section>

      {row.declaredSource ? (
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">
              Declared source
            </dt>
            <dd>{row.declaredSource}</dd>
          </div>
        </dl>
      ) : null}

      <section>
        <h4 className="font-label text-[10px] uppercase text-on-surface-variant">
          Evidence files {row.evidenceCount > 0 ? `(${row.evidenceCount})` : ""}
        </h4>
        <div className="mt-2">
          <SofEvidenceList detail={detail} evidenceCount={row.evidenceCount} />
        </div>
      </section>

      <SofCaseAuditTrail row={row} detail={detail} />

      <AdminTechnicalIdDisclosure
        items={[
          { label: "Case ID", value: row.id },
          { label: "User ID", value: row.userId },
        ]}
      />

      <ComplianceTriageForm
        entityId={row.id}
        entityKind="sof"
        canTriage={canTriage}
        triageDone={!!row.triageRecommendation}
      />
      <ComplianceDecideForm
        entityId={row.id}
        entityKind="sof"
        canDecide={canDecide}
        triageDone={!!row.triageRecommendation}
        triagedByUserId={row.triagedByUserId}
        currentUserId={currentUserId}
      />
    </div>
  );
}
