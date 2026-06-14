"use client";

import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
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
    <div className="space-y-4">
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Buyer</dt>
          <dd>
            <Link href={`/admin/clients/${row.userId}`} className="text-link underline">
              View client profile
            </Link>
          </dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Trigger</dt>
          <dd>{row.triggerLabel}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Threshold</dt>
          <dd>{row.thresholdLabel}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">
            Exposure at gate
          </dt>
          <dd>{row.exposureLabel}</dd>
        </div>
        {row.declaredSource ? (
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">
              Declared source
            </dt>
            <dd>{row.declaredSource}</dd>
          </div>
        ) : null}
        {row.evidenceCount > 0 ? (
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">
              Evidence files ({row.evidenceCount})
            </dt>
            <dd>
              <ul className="mt-1 space-y-1">
                {row.evidenceKeys.map((key) => {
                  const fileName = key.split("/").pop() ?? key;
                  return (
                    <li
                      key={key}
                      className="flex items-center gap-2 rounded border border-border-hairline bg-surface-container-low px-2 py-1 font-mono text-[10px] text-on-surface-variant"
                      title={key}
                    >
                      <span className="truncate">{fileName}</span>
                      <span className="shrink-0 font-label text-[9px] uppercase tracking-wide text-secondary">
                        Uploaded
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 font-body text-[11px] text-on-surface-variant">
                Presigned download links are available to MLRO staff via the file management
                pipeline. Contact the platform admin for direct access.
              </p>
            </dd>
          </div>
        ) : (
          <div>
            <dt className="font-label text-[10px] uppercase text-on-surface-variant">
              Evidence files
            </dt>
            <dd className="text-on-surface-variant">None submitted</dd>
          </div>
        )}
      </dl>

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
