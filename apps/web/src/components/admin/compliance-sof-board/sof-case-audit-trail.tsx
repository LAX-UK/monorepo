"use client";

import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { formatDateTime } from "@/lib/ui/format";

type Props = {
  row: AdminSofTableRow;
  detail: AdminSourceOfFundsDetail | null;
};

export function SofCaseAuditTrail({ row, detail }: Props) {
  const triagedBy = detail?.triagedBy?.label ?? row.triagedByUserId;
  const reviewedBy = detail?.reviewedBy?.label ?? row.reviewedByUserId;

  if (!row.triageRecommendation && !row.reviewedAt && !row.triageNotes && !row.reviewNotes) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h4 className="font-label text-[10px] uppercase text-on-surface-variant">Review history</h4>
      <dl className="grid gap-3 text-sm">
        {row.triageRecommendation ? (
          <>
            <div>
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">Triage</dt>
              <dd>{row.triageLabel}</dd>
            </div>
            {triagedBy ? (
              <div>
                <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                  Triaged by
                </dt>
                <dd>{triagedBy}</dd>
              </div>
            ) : null}
            {row.triagedAt ? (
              <div>
                <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                  Triaged at
                </dt>
                <dd>{formatDateTime(row.triagedAt)}</dd>
              </div>
            ) : null}
            {row.triageNotes ? (
              <div>
                <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                  Triage notes
                </dt>
                <dd className="whitespace-pre-wrap">{row.triageNotes}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {row.reviewedAt ? (
          <>
            <div>
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                MLRO decision
              </dt>
              <dd>{row.statusLabel}</dd>
            </div>
            {reviewedBy ? (
              <div>
                <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                  Decided by
                </dt>
                <dd>{reviewedBy}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                Decided at
              </dt>
              <dd>{formatDateTime(row.reviewedAt)}</dd>
            </div>
            {row.reviewNotes ? (
              <div>
                <dt className="font-label text-[10px] uppercase text-on-surface-variant">
                  Decision notes
                </dt>
                <dd className="whitespace-pre-wrap">{row.reviewNotes}</dd>
              </div>
            ) : null}
          </>
        ) : null}
      </dl>
    </section>
  );
}
