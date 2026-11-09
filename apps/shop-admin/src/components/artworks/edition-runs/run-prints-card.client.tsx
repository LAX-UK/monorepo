"use client";

import { SetPrintApartDialog } from "@/components/artworks/edition-runs/set-print-apart-dialog.client";
import {
  printIdentity,
  printOwnerLabel,
  printStatus,
  runEditionLine,
} from "@/server/domain/edition-run.vm";
import type {
  AdminEditionFacts,
  AdminEditionRunSpec,
  AdminRunPrint,
} from "@auction/shop-contracts";
import {
  CellLink,
  type DataColumn,
  type OverflowAction,
  RelatedRecordsSection,
  StatusBadge,
  rowActionsColumn,
} from "@auction/staff-ui";
import { Link2, Sparkles } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useState } from "react";

const SOLD_TO_BE_LEFT_OUT = new Set<AdminRunPrint["status"]>(["sold"]);

/**
 * The run's prints, one row each, with a `…` menu on every row. "Set this print apart…" sells
 * one print that differs from the rest on its own; a print already set apart links to its listing
 * instead. A sold print is not offered in the menu, and one that cannot be set apart now (in a
 * basket, held, withdrawn) opens the dialog to say why. Numbered runs and proof listings only.
 */
export function RunPrintsCard({
  artworkId,
  title,
  spec,
  runPrice,
  runSignature,
  prints,
  permissions,
}: {
  artworkId: string;
  title: string;
  spec: AdminEditionRunSpec;
  /** What the run sells at, as text ("£180"), or null while it has no price. */
  runPrice: string | null;
  /** How the run is signed; null until its facts are recorded. */
  runSignature: AdminEditionFacts["signature"] | null;
  prints: readonly AdminRunPrint[];
  permissions: { write: boolean; setPrice: boolean };
}) {
  const [target, setTarget] = useState<AdminRunPrint | null>(null);
  const identity = target ? printIdentity(spec, target) : null;

  const actions = (row: AdminRunPrint): readonly OverflowAction[] => {
    if (!permissions.write) return [];
    if (row.setApart) {
      return [
        {
          id: "open-listing",
          label: "Open its listing",
          icon: Link2,
          href: `/artworks/${row.setApart.listingArtworkId}`,
        },
      ];
    }
    if (SOLD_TO_BE_LEFT_OUT.has(row.status)) return [];
    const reason = !runSignature
      ? "Record and confirm the run's edition facts first"
      : !permissions.setPrice
        ? "Setting a price needs price access"
        : undefined;
    return [
      {
        id: "set-apart",
        label: "Set this print apart…",
        icon: Sparkles,
        onSelect: () => setTarget(row),
        ...(reason ? { disabledReason: reason } : {}),
      },
    ];
  };

  const columns: readonly DataColumn<AdminRunPrint>[] = [
    {
      id: "print",
      header: "Print",
      numeric: true,
      width: "96px",
      sortValue: (row) => Number.parseInt(row.label.replace(/\D+/g, ""), 10) || 0,
      sortable: true,
      cell: (row) => row.label,
      mobile: "title",
    },
    { id: "owner", header: "Held by", cell: (row) => printOwnerLabel(row.owner), mobile: "meta" },
    {
      id: "status",
      header: "Status",
      cell: (row) => {
        const status = printStatus(row.status);
        return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
      },
      mobile: "badge",
    },
    {
      id: "listing",
      header: "Listing",
      hideBelow: "md",
      cell: (row) =>
        row.setApart ? (
          <CellLink href={`/artworks/${row.setApart.listingArtworkId}`} Link={Link}>
            {row.setApart.title}
          </CellLink>
        ) : null,
      mobile: "hidden",
    },
    rowActionsColumn<AdminRunPrint>({
      actions,
      label: (row) => `Actions for print ${row.label}`,
      Link,
    }),
  ];

  return (
    <>
      <RelatedRecordsSection<AdminRunPrint>
        id="prints"
        title="Prints"
        description="Every print of the run. A print that differs from the rest can be set apart and sold on its own."
        columns={columns}
        data={prints}
        getRowId={(row) => row.editionId}
        defaultSort={{ columnId: "print", direction: "asc" }}
        empty={{
          title: "No prints yet",
          description: "The prints appear here once the run is saved.",
        }}
      />
      {permissions.write && target && identity && runSignature ? (
        <SetPrintApartDialog
          open
          onOpenChange={(next) => {
            if (!next) setTarget(null);
          }}
          artworkId={artworkId}
          runTitle={title}
          runLine={runEditionLine(spec)}
          runPrice={runPrice}
          runSignature={runSignature}
          print={target}
          identity={identity}
        />
      ) : null}
    </>
  );
}
