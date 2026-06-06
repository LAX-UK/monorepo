"use client";

import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  ComplianceDecideForm,
  ComplianceTriageForm,
} from "@/components/admin/compliance/compliance-review-forms";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import Link from "next/link";

type Props = {
  row: AdminSofTableRow;
  canTriage: boolean;
  canDecide: boolean;
  currentUserId: string;
};

export function SofDrawerContent({ row, canTriage, canDecide, currentUserId }: Props) {
  return (
    <div className="space-y-4 pt-2">
      <AdminPreviewSheetHeader
        title="Source of Funds"
        subtitle={<AdminStatusBadge domain="sofCase" status={row.status} />}
      />
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="text-xs text-on-surface-variant">Buyer</dt>
          <dd>
            <Link href={`/admin/clients/${row.userId}`} className="text-primary underline">
              View client profile
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-on-surface-variant">Trigger</dt>
          <dd>{row.triggerLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-on-surface-variant">Threshold</dt>
          <dd>{row.thresholdLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-on-surface-variant">Exposure at gate</dt>
          <dd>{row.exposureLabel}</dd>
        </div>
        {row.declaredSource ? (
          <div>
            <dt className="text-xs text-on-surface-variant">Declared source</dt>
            <dd>{row.declaredSource}</dd>
          </div>
        ) : null}
      </dl>
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
