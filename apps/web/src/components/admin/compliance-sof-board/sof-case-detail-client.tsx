"use client";

import { SofCaseAuditTrail } from "@/components/admin/compliance-sof-board/sof-case-audit-trail";
import { SofCaseTimeline } from "@/components/admin/compliance-sof-board/sof-case-timeline";
import { SofEvidenceReviewer } from "@/components/admin/compliance-sof-board/sof-evidence-reviewer";
import { SofSettlementBreakdown } from "@/components/admin/compliance-sof-board/sof-settlement-breakdown";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import {
  SOF_STALE_RELOAD_MESSAGE,
  isSofStaleConflictMessage,
} from "@/lib/admin/compliance-error-messages";
import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { buildSofTimeline } from "@/lib/data/view-models/admin-sof-timeline.vm";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  row: AdminSofTableRow;
  detail: AdminSourceOfFundsDetail;
  readOnly: boolean;
  canTriage: boolean;
  canDecide: boolean;
  currentUserId: string;
  success?: string | null;
  error?: string | null;
};

export function SofCaseDetailClient({
  row,
  detail,
  readOnly,
  canTriage,
  canDecide,
  currentUserId,
  success,
  error,
}: Props) {
  const router = useRouter();
  const steps = buildSofTimeline({ row, detail, canTriage, canDecide, currentUserId });
  const staleConflict = Boolean(error && isSofStaleConflictMessage(error));

  return (
    <div className="min-w-0 space-y-6">
      {success ? (
        <Alert>
          <AlertTitle>Done</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}
      {staleConflict ? (
        <Alert>
          <AlertTitle>Case changed</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{SOF_STALE_RELOAD_MESSAGE}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => router.refresh()}>
              Reload case
            </Button>
          </AlertDescription>
        </Alert>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>Attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => router.refresh()}>
          Refresh
        </Button>
      </div>

      <SofCaseTimeline steps={steps} />

      <SofEvidenceReviewer caseId={row.id} row={row} detail={detail} readOnly={readOnly} />

      <CollapsibleSection title="Settlement exposure" defaultOpen>
        <div className="p-4">
          <SofSettlementBreakdown detail={detail} />
          {detail.blockedPayments.length > 0 ? (
            <p className="mt-3 font-body text-sm">
              <Link
                href="/admin/payments?manualReview=1&manualReviewReason=source_of_funds_required"
                className="text-link underline"
              >
                {detail.blockedPayments.length} payment
                {detail.blockedPayments.length === 1 ? "" : "s"} in manual review
              </Link>
            </p>
          ) : null}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Why this case exists">
        <dl className="grid gap-3 p-4 text-sm">
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
          <Alert>
            <AlertTitle>Buyer-scoped gate</AlertTitle>
            <AlertDescription>
              This case blocks the buyer&apos;s entire settlement profile until MLRO approves.
            </AlertDescription>
          </Alert>
        </dl>
      </CollapsibleSection>

      <CollapsibleSection title="Review history">
        <div className="p-4">
          <SofCaseAuditTrail row={row} detail={detail} />
        </div>
      </CollapsibleSection>
    </div>
  );
}
