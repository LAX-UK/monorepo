"use client";

import { CONDITION_REPORT_STATUS_BADGE } from "@/lib/condition-report/condition-report-status-badge";
import type { BuyerConditionReportRequestVM } from "@/lib/condition-report/map-buyer-condition-report-requests.vm";
import { RecordRow, RecordRowMedia } from "@auction/ui";
import { ButtonLink, StatusBadge } from "@auction/ui/lax";
import { FileText } from "lucide-react";
import Link from "next/link";

/**
 * One condition report the person asked for: the lot, when they asked, where it stands and, once
 * it is ready, the one step (Download). The row opens the lot.
 */
export function ConditionReportRow({ row }: { row: BuyerConditionReportRequestVM }) {
  const badge = CONDITION_REPORT_STATUS_BADGE[row.status];
  return (
    <RecordRow
      aria-label={`${row.lotTitle}, ${row.statusLabel}`}
      href={row.lotHref}
      linkAs={Link}
      leading={
        <RecordRowMedia className="grid place-items-center text-lax-muted">
          <FileText aria-hidden className="size-5" strokeWidth={1.5} />
        </RecordRowMedia>
      }
      // The whole title stays readable where a narrow row cuts it short.
      title={<span title={row.lotTitle}>{row.lotTitle}</span>}
      meta={[row.lotNumberLabel]}
      figures={[{ value: row.requestedAtLabel, label: "asked", labelFirst: true }]}
      // Why we could not prepare it, in full under the row rather than cut off in the facts.
      {...(row.status === "declined" && row.responseNote
        ? { detail: <p className="text-lax-13 text-lax-muted">{row.responseNote}</p> }
        : {})}
      aligned
      status={
        <StatusBadge tone={badge.tone} shape={badge.shape}>
          {row.statusLabel}
        </StatusBadge>
      }
      action={
        row.downloadUrl ? (
          <ButtonLink
            href={row.downloadUrl}
            target="_blank"
            rel="noreferrer"
            size="sm"
            variant="secondary"
            aria-label={`Download the condition report for ${row.lotTitle}`}
          >
            Download
          </ButtonLink>
        ) : null
      }
    />
  );
}
