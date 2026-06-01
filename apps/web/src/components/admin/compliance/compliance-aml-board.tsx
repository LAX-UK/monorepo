"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import {
  ComplianceDecideForm,
  ComplianceTriageForm,
} from "@/components/admin/compliance/compliance-review-forms";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminAmlScreeningRow } from "@/lib/data/http/compliance.server";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

type Props = {
  rows: AdminAmlScreeningRow[];
  canTriage: boolean;
  canDecide: boolean;
  currentUserId: string;
};

export function ComplianceAmlBoard({ rows, canTriage, canDecide, currentUserId }: Props) {
  const { density } = useTableDensity();
  const [selected, setSelected] = useState<AdminAmlScreeningRow | null>(null);
  const onOpen = useCallback((row: AdminAmlScreeningRow) => setSelected(row), []);

  const columns = useMemo((): ColumnDef<AdminAmlScreeningRow>[] => {
    const open = onOpen;
    return [
      {
        id: "match",
        header: "Match",
        cell: ({ row }) => <span className="font-body text-sm">{row.original.matchStatus}</span>,
      },
      {
        id: "outcome",
        header: "Policy",
        cell: ({ row }) => <Badge variant="outline">{row.original.decisionOutcome}</Badge>,
      },
      {
        id: "categories",
        header: "Categories",
        cell: ({ row }) => (
          <span className="text-sm text-on-surface-variant">
            {row.original.categories.length > 0 ? row.original.categories.join(", ") : "—"}
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
            ariaLabel="AML screenings pending review"
            columns={columns}
            data={rows}
            emptyMessage="No pending AML screenings."
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
                  <p className="font-medium">{row.matchStatus}</p>
                  <p className="text-sm text-on-surface-variant">{row.decisionOutcome}</p>
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
                title="Watchlist screening"
                subtitle={
                  <p className="font-mono text-xs text-on-surface-variant">{selected.id}</p>
                }
              />
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="text-xs text-on-surface-variant">User</dt>
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
                  <dt className="text-xs text-on-surface-variant">Provider session</dt>
                  <dd className="break-all font-mono text-xs">{selected.providerSessionId}</dd>
                </div>
                <div>
                  <dt className="text-xs text-on-surface-variant">Hits</dt>
                  <dd>{selected.totalHits}</dd>
                </div>
                {selected.triageNotes ? (
                  <div>
                    <dt className="text-xs text-on-surface-variant">Triage notes</dt>
                    <dd>{selected.triageNotes}</dd>
                  </div>
                ) : null}
              </dl>
              <ComplianceTriageForm
                entityId={selected.id}
                entityKind="aml"
                canTriage={canTriage}
                triageDone={!!selected.triageRecommendation}
              />
              <ComplianceDecideForm
                entityId={selected.id}
                entityKind="aml"
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
