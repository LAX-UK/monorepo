"use client";

import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import {
  type DataColumn,
  PrimaryCell,
  type StaffLinkComponent,
  StaffMoney,
  StatusBadge,
  rowActionsColumn,
} from "@auction/staff-ui";
import type { Lot } from "@auction/types";
import { Pencil } from "lucide-react";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

type Props = {
  artistId: string;
  lots: Lot[];
  /** Shown above the table, e.g. a heading when the panel sits on a form page. */
  title?: string;
  description?: string;
};

function minor(major: string | null | undefined): number | null {
  if (major === null || major === undefined || major === "") return null;
  const value = Number.parseFloat(major);
  return Number.isNaN(value) ? null : Math.round(value * 100);
}

const columns: DataColumn<Lot>[] = [
  {
    id: "lot",
    header: "Lot",
    sortable: true,
    sortValue: (lot) => lot.title.toLowerCase(),
    mobile: "title",
    cell: (lot) => (
      <PrimaryCell
        href={`/admin/lots/${lot.id}`}
        Link={NextLink}
        secondary={
          [lot.medium, lot.artistReviewRequired ? "Artist needs review" : null]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      >
        {lot.title}
      </PrimaryCell>
    ),
  },
  {
    id: "status",
    header: "Status",
    width: "140px",
    mobile: "badge",
    cell: (lot) => {
      const status = staffStatus("lot", lot.status, { lot: { winnerId: lot.winnerId } });
      return (
        <StatusBadge tone={status.tone} live={status.live ?? false}>
          {status.label}
        </StatusBadge>
      );
    },
  },
  {
    id: "price",
    header: "Hammer or starting price",
    numeric: true,
    width: "200px",
    mobile: "meta",
    cell: (lot) => (
      <StaffMoney
        minor={minor(lot.status === "ended" ? lot.currentPrice : lot.startingPrice)}
        currency={lot.marketingDetails?.estimate?.currency ?? "GBP"}
      />
    ),
  },
  rowActionsColumn<Lot>({
    label: (lot) => `Actions for ${lot.title}`,
    Link: NextLink,
    actions: (lot) => [
      { id: "edit", label: "Edit lot", icon: Pencil, href: `/admin/lots/${lot.id}/edit` },
    ],
  }),
];

/** Lots currently attributed to an artist, newest first, as a read-only related table. */
export function AdminArtistLotsPanel({ artistId, lots, title = "Lots", description }: Props) {
  return (
    <RelatedRecordsSection<Lot>
      title={title}
      {...(description ? { description } : {})}
      label="Lots by this artist"
      columns={columns}
      data={lots}
      getRowId={(lot) => lot.id}
      defaultSort={{ columnId: "lot", direction: "asc" }}
      density="comfortable"
      empty={{
        title: "No lots attributed",
        description:
          "Lots appear here once they are attributed to this artist, from the lot's edit page or by approving a submission with this artist.",
      }}
      {...(lots.length > 0
        ? {
            footer: (
              <>
                Showing the {lots.length} most recent lots.{" "}
                <Link
                  href={`/admin/lots?artistId=${encodeURIComponent(artistId)}`}
                  className="font-medium text-staff-fg underline underline-offset-2"
                >
                  See every lot by this artist
                </Link>
              </>
            ),
          }
        : {})}
    />
  );
}
