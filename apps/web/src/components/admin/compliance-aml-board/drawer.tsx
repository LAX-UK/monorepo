"use client";

import { AdminAmlHitListings } from "@/components/admin/admin-aml-hit-listings";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
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
    <div className="space-y-4">
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">User</dt>
          <dd>
            <Link href={`/admin/clients/${row.userId}`} className="text-primary underline">
              View client profile
            </Link>
          </dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Monitor</dt>
          <dd>
            <AdminStatusBadge domain="amlMonitor" status={row.monitorStatus} size="sm" />
          </dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Categories</dt>
          <dd>{row.categoriesLabel}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">
            Watchlist hits
          </dt>
          <dd>{row.totalHits}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Screened</dt>
          <dd>{row.screenedAt}</dd>
        </div>
        {row.checkType ? (
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">Check type</dt>
            <dd>{row.checkType}</dd>
          </div>
        ) : null}
        {row.triageNotes ? (
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">
              Triage notes
            </dt>
            <dd>{row.triageNotes}</dd>
          </div>
        ) : null}
      </dl>

      <div>
        <h4 className="font-label text-[10px] uppercase text-on-surface-variant">Hit detail</h4>
        <div className="mt-2">
          <AdminAmlHitListings hits={row.hits} />
        </div>
      </div>

      <AdminTechnicalIdDisclosure
        items={[
          { label: "Case ID", value: row.id },
          { label: "User ID", value: row.userId },
          { label: "Provider session ID", value: row.providerSessionId },
        ]}
      />

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
