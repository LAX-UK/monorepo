"use client";

import { presentArtworkState } from "@/server/domain/artwork-list.vm";
import type { AdminArtworkDetail } from "@auction/shop-contracts";
import {
  CellLink,
  type DataColumn,
  MappedStatusBadge,
  RelatedRecordsSection,
} from "@auction/staff-ui";
import Link from "next/link";
import type * as React from "react";

type Print = NonNullable<AdminArtworkDetail["linkedPrints"]>[number];

const COLUMNS: readonly DataColumn<Print>[] = [
  {
    id: "title",
    header: "Prints",
    cell: (row) => (
      <CellLink href={`/artworks/${row.artworkId}`} Link={Link}>
        {row.title}
      </CellLink>
    ),
    mobile: "title",
  },
  {
    id: "state",
    header: "Status",
    cell: (row) => <MappedStatusBadge status={row.state} present={presentArtworkState} />,
    mobile: "meta",
  },
  {
    id: "size",
    header: "In the run",
    cell: (row) => (row.size === 1 ? "1 print" : `${row.size} prints`),
    mobile: "meta",
  },
];

/**
 * The Shop listings made from an original, each a separate artwork linked back to it. The
 * creating action sits in the section's header, or in its empty state while there are none.
 */
export function LinkedPrintsCard({
  prints,
  action,
  emptyDescription,
}: {
  prints: NonNullable<AdminArtworkDetail["linkedPrints"]>;
  /** "Create prints", when this person may and the original can have them. */
  action: React.ReactNode;
  emptyDescription: string;
}) {
  return (
    <RelatedRecordsSection<Print>
      id="linked-prints"
      title="Prints"
      description="Shop listings made from this original."
      columns={COLUMNS}
      data={prints}
      getRowId={(row) => row.artworkId}
      defaultSort={{ columnId: "title", direction: "asc" }}
      rowHref={(row) => `/artworks/${row.artworkId}`}
      action={action}
      empty={{
        title: "No prints yet",
        description: emptyDescription,
        ...(action ? { action } : {}),
      }}
    />
  );
}
