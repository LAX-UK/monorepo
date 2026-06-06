"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { useTableDensity } from "@/components/layout/density-provider";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

export function OnboardingIssuesTable<T extends { id: string }>({
  rows,
  columns,
  emptyTitle,
  renderCard,
}: {
  rows: T[];
  columns: ColumnDef<T>[];
  emptyTitle: string;
  renderCard?: (row: T) => ReactNode;
}) {
  const { density } = useTableDensity();
  if (rows.length === 0) {
    return <AdminEmptyState title={emptyTitle} description="Nothing in this queue right now." />;
  }

  const cards = renderCard ? (
    <ul className="space-y-2 lg:hidden">
      {rows.map((row) => (
        <li
          key={row.id}
          className="rounded-lg border border-border-hairline bg-surface-container-lowest/80 p-4"
        >
          {renderCard(row)}
        </li>
      ))}
    </ul>
  ) : null;

  return (
    <>
      <div className="hidden lg:block">
        <AdminDataTable
          ariaLabel={emptyTitle}
          columns={columns}
          data={rows}
          density={density}
          getRowId={(r) => r.id}
        />
      </div>
      {cards}
    </>
  );
}
