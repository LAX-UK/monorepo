"use client";

import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  ComplianceDecideForm,
  ComplianceTriageForm,
} from "@/components/admin/compliance/compliance-review-forms";
import type { AdminAmlTableRow } from "@/lib/data/view-models/admin-aml-table.vm";
import Link from "next/link";

type Props = {
  row: AdminAmlTableRow;
  canTriage: boolean;
  canDecide: boolean;
  currentUserId: string;
};

export function AmlDrawerContent({ row, canTriage, canDecide, currentUserId }: Props) {
  return (
    <div className="space-y-4 pt-2">
      <AdminPreviewSheetHeader
        title="Watchlist screening"
        subtitle={
          <div className="flex flex-wrap gap-2">
            <AdminStatusBadge domain="amlMatch" status={row.matchStatus} />
            <AdminStatusBadge domain="amlDecision" status={row.decisionOutcome} />
          </div>
        }
      />
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="text-xs text-on-surface-variant">User</dt>
          <dd>
            <Link href={`/admin/clients/${row.userId}`} className="text-primary underline">
              View client profile
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-on-surface-variant">Categories</dt>
          <dd>{row.categoriesLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-on-surface-variant">Watchlist hits</dt>
          <dd>{row.totalHits}</dd>
        </div>
        <div>
          <dt className="text-xs text-on-surface-variant">Screened</dt>
          <dd>{row.screenedAt}</dd>
        </div>
        {row.triageNotes ? (
          <div>
            <dt className="text-xs text-on-surface-variant">Triage notes</dt>
            <dd>{row.triageNotes}</dd>
          </div>
        ) : null}
      </dl>
      <ComplianceTriageForm
        entityId={row.id}
        entityKind="aml"
        canTriage={canTriage}
        triageDone={!!row.triageRecommendation}
      />
      <ComplianceDecideForm
        entityId={row.id}
        entityKind="aml"
        canDecide={canDecide}
        triageDone={!!row.triageRecommendation}
        triagedByUserId={row.triagedByUserId}
        currentUserId={currentUserId}
      />
    </div>
  );
}
