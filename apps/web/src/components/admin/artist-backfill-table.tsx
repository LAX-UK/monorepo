"use client";

import {
  type DataColumn,
  DataTable,
  EmptyValue,
  PrimaryCell,
  StaffDate,
  type StaffLinkComponent,
  rowActionsColumn,
} from "@auction/staff-ui";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

export type ArtistBackfillRow = {
  id: string;
  lotId: string | null;
  title: string;
  /** Why the match could not be made automatically. */
  classification: string;
  /** The artist text typed on the lot. */
  hintText: string;
  /** How many profiles the typed text could mean. */
  ambiguityCount: number;
  createdAt: Date | string;
};

const PROBLEM: Record<string, string> = {
  ambiguous_text: "More than one profile matches the typed name",
  value_is_user_id: "The artist field holds an account, not a profile",
  corrupt: "The artist field could not be read",
  text_no_match: "No profile matches the typed name",
};

function problem(row: ArtistBackfillRow): string {
  const base = PROBLEM[row.classification] ?? "Needs a person to choose the profile";
  return row.classification === "ambiguous_text" && row.ambiguityCount > 1
    ? `${row.ambiguityCount} profiles match the typed name`
    : base;
}

const columns: DataColumn<ArtistBackfillRow>[] = [
  {
    id: "lot",
    header: "Lot",
    sortable: true,
    sortValue: (row) => row.title.toLowerCase(),
    mobile: "title",
    cell: (row) => (
      <PrimaryCell
        {...(row.lotId ? { href: `/admin/lots/${row.lotId}`, Link: NextLink } : {})}
        secondary={problem(row)}
      >
        {row.title}
      </PrimaryCell>
    ),
  },
  {
    id: "typed",
    header: "Artist typed on the lot",
    hideBelow: "md",
    mobile: "meta",
    cell: (row) => (row.hintText ? row.hintText : <EmptyValue />),
  },
  {
    id: "raised",
    header: "Raised",
    width: "140px",
    sortable: true,
    defaultSortDirection: "desc",
    sortValue: (row) => new Date(row.createdAt).getTime(),
    mobile: "meta",
    cell: (row) => <StaffDate value={row.createdAt} />,
  },
  rowActionsColumn<ArtistBackfillRow>({
    label: (row) => `Actions for ${row.title}`,
    Link: NextLink,
    actions: (row) =>
      row.lotId
        ? [
            {
              id: "open",
              label: "Open lot",
              icon: ExternalLink,
              href: `/admin/lots/${row.lotId}`,
            },
          ]
        : [],
  }),
];

/** Lots waiting for a person to choose their artist profile, newest first. */
export function ArtistBackfillTable({ rows }: { rows: ArtistBackfillRow[] }) {
  return (
    <DataTable<ArtistBackfillRow>
      label="Lots waiting for an artist match"
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      density="comfortable"
      defaultSort={{ columnId: "raised", direction: "desc" }}
      stickyToolbar={false}
    />
  );
}
