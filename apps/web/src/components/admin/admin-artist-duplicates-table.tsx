"use client";

import { staffStatus } from "@/lib/admin/staff-kit-status";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import type { AdminArtistDuplicateHit } from "@/lib/data/http/admin.server";
import {
  type DataColumn,
  DataTable,
  EmptyState,
  PrimaryCell,
  type StaffLinkComponent,
  StatusBadge,
  rowActionsColumn,
} from "@auction/staff-ui";
import { UserRound } from "lucide-react";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

const columns: DataColumn<AdminArtistDuplicateHit>[] = [
  {
    id: "name",
    header: "Name",
    sortable: true,
    sortValue: (row) => row.displayName.toLowerCase(),
    mobile: "title",
    cell: (row) => (
      <PrimaryCell href={`/admin/artists/${row.id}`} Link={NextLink}>
        {row.displayName}
      </PrimaryCell>
    ),
  },
  {
    id: "kind",
    header: "Kind",
    width: "180px",
    mobile: "meta",
    cell: (row) => artistKindMeta(row.kind).badge,
  },
  {
    id: "status",
    header: "Status",
    width: "160px",
    mobile: "badge",
    cell: (row) => {
      const status = staffStatus("artist", row.status);
      return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
    },
  },
  rowActionsColumn<AdminArtistDuplicateHit>({
    label: (row) => `Actions for ${row.displayName}`,
    Link: NextLink,
    actions: (row) => [
      {
        id: "open",
        label: "Open profile",
        icon: UserRound,
        href: `/admin/artists/${row.id}`,
      },
    ],
  }),
];

/**
 * Artists whose names resemble another, as a table that sits inside a `Section` (which is the
 * card). Each name opens the profile, so staff can compare before merging.
 */
export function AdminArtistDuplicatesTable({ rows }: { rows: AdminArtistDuplicateHit[] }) {
  return (
    <DataTable<AdminArtistDuplicateHit>
      embedded
      label="Artist duplicate candidates"
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      density="compact"
      defaultSort={{ columnId: "name", direction: "asc" }}
      stickyHeader={false}
      stickyToolbar={false}
      empty={
        <EmptyState
          headingLevel="h3"
          title="No duplicate candidates"
          description="Profiles with similar names appear here so they can be merged."
        />
      }
    />
  );
}
