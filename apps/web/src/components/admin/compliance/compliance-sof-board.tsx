"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import {
  ComplianceDecideForm,
  ComplianceTriageForm,
} from "@/components/admin/compliance/compliance-review-forms";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminSourceOfFundsRow } from "@/lib/data/http/compliance.server";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

type Props = {
  rows: AdminSourceOfFundsRow[];
  canTriage: boolean;
  canDecide: boolean;
  currentUserId: string;
};

export function ComplianceSofBoard({ rows, canTriage, canDecide, currentUserId }: Props) {
  const { density } = useTableDensity();
  const [selected, setSelected] = useState<AdminSourceOfFundsRow | null>(null);
  const onOpen = useCallback((row: AdminSourceOfFundsRow) => setSelected(row), []);

  const columns = useMemo((): ColumnDef<AdminSourceOfFundsRow>[] => {
    const open = onOpen;
    return [
      {
        id: "trigger",
        header: "Trigger",
        cell: ({ row }) => <Badge variant="outline">{row.original.trigger}</Badge>,
      },
      {
        id: "exposure",
        header: "Exposure",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.currency} {row.original.exposureAmount}
          </span>
        ),
      },
      {
        id: "triage",
        header: "Triage",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.triageRecommendation
              ? row.original.triageRecommendation.replace("recommend_", "")
              : "Pending"}
          </span>
        ),
      },
      {
        id: "open",
        header: "",
        cell: ({ row }) => (
          <Button type="button" variant="secondary" size="sm" onClick={() => open(row.original)}>
            Review
          </Button>
        ),
        enableSorting: false,
      },
    ];
  }, [onOpen]);

  return (
    <>
      <EntityList
        responsiveMode="auto"
        density={density}
        table={
          <AdminDataTable
            ariaLabel="Source of Funds cases pending review"
            columns={columns}
            data={rows}
            emptyMessage="No pending Source of Funds cases."
            density={density}
            getRowId={(r) => r.id}
          />
        }
        cards={
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="w-full rounded-lg border border-outline-variant/40 p-4 text-left"
                  onClick={() => onOpen(row)}
                >
                  <p className="font-medium">{row.trigger}</p>
                  <p className="text-sm text-on-surface-variant">
                    {row.currency} {row.exposureAmount}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        }
      />
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full max-w-lg overflow-y-auto">
          {selected ? (
            <div className="space-y-4 pt-2">
              <AdminPreviewSheetHeader
                title="Source of Funds"
                subtitle={
                  <p className="font-mono text-xs text-on-surface-variant">{selected.id}</p>
                }
              />
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="text-xs text-on-surface-variant">Buyer</dt>
                  <dd>
                    <Link
                      href={`/admin/clients/${selected.userId}`}
                      className="text-primary underline"
                    >
                      {selected.userId}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-on-surface-variant">Threshold</dt>
                  <dd>
                    {selected.currency} {selected.thresholdAmount}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-on-surface-variant">Exposure at gate</dt>
                  <dd>
                    {selected.currency} {selected.exposureAmount}
                  </dd>
                </div>
                {selected.declaredSource ? (
                  <div>
                    <dt className="text-xs text-on-surface-variant">Declared source</dt>
                    <dd>{selected.declaredSource}</dd>
                  </div>
                ) : null}
              </dl>
              <ComplianceTriageForm
                entityId={selected.id}
                entityKind="sof"
                canTriage={canTriage}
                triageDone={!!selected.triageRecommendation}
              />
              <ComplianceDecideForm
                entityId={selected.id}
                entityKind="sof"
                canDecide={canDecide}
                triageDone={!!selected.triageRecommendation}
                triagedByUserId={selected.triagedByUserId}
                currentUserId={currentUserId}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
