"use client";

import { SofCaseAuditTrail } from "@/components/admin/compliance-sof-board/sof-case-audit-trail";
import { SofEvidenceReviewer } from "@/components/admin/compliance-sof-board/sof-evidence-reviewer";
import { SofSettlementBreakdown } from "@/components/admin/compliance-sof-board/sof-settlement-breakdown";
import {
  SOF_STALE_RELOAD_MESSAGE,
  isSofStaleConflictMessage,
} from "@/lib/admin/compliance-error-messages";
import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import {
  KeyValueList,
  Notice,
  Section,
  StaffButton,
  type StaffLinkComponent,
  TextLink,
} from "@auction/staff-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";

const NextLink: StaffLinkComponent = Link;

type Props = {
  row: AdminSofTableRow;
  detail: AdminSourceOfFundsDetail;
  readOnly: boolean;
  success?: string | null;
  error?: string | null;
};

/** The case's workflow, evidence, settlement exposure, why it exists and its review history. */
export function SofCaseDetailClient({ row, detail, readOnly, success, error }: Props) {
  const router = useRouter();
  const staleConflict = Boolean(error && isSofStaleConflictMessage(error));
  const blocked = detail.blockedPayments.length;

  return (
    <>
      {success ? <Notice tone="success" title={success} /> : null}
      {staleConflict ? (
        <Notice
          tone="warning"
          title="Case changed"
          actions={
            <StaffButton size="sm" variant="secondary" onClick={() => router.refresh()}>
              Reload case
            </StaffButton>
          }
        >
          {SOF_STALE_RELOAD_MESSAGE}
        </Notice>
      ) : error ? (
        <Notice tone="danger" alert title="That did not go through">
          {error}
        </Notice>
      ) : null}

      <SofEvidenceReviewer caseId={row.id} row={row} detail={detail} readOnly={readOnly} />

      <Section title="Settlement exposure">
        <div className="flex flex-col gap-3">
          <SofSettlementBreakdown detail={detail} />
          {blocked > 0 ? (
            <p className="text-staff-sm">
              <TextLink
                Link={NextLink}
                href="/admin/payments?manualReview=1&manualReviewReason=source_of_funds_required"
              >
                {blocked} payment{blocked === 1 ? "" : "s"} in manual review
              </TextLink>
            </p>
          ) : null}
        </div>
      </Section>

      <Section title="Why this case exists">
        <div className="flex flex-col gap-4">
          <KeyValueList
            items={[
              {
                label: "Trigger",
                value: (
                  <span className="flex flex-col">
                    {row.triggerLabel}
                    {row.triggerExplanation ? (
                      <span className="text-staff-muted">{row.triggerExplanation}</span>
                    ) : null}
                  </span>
                ),
              },
              { label: "Threshold", value: row.thresholdLabel },
              { label: "Exposure at open", value: row.exposureLabel },
            ]}
          />
          <Notice tone="info" title="Buyer-scoped gate">
            This case blocks the buyer&apos;s entire settlement profile until the MLRO approves.
          </Notice>
        </div>
      </Section>

      <SofHistory row={row} detail={detail} />
    </>
  );
}

function SofHistory({
  row,
  detail,
}: {
  row: AdminSofTableRow;
  detail: AdminSourceOfFundsDetail;
}) {
  if (!row.triageRecommendation && !row.reviewedAt && !row.triageNotes && !row.reviewNotes) {
    return null;
  }
  return (
    <Section title="Review history">
      <SofCaseAuditTrail row={row} detail={detail} />
    </Section>
  );
}
