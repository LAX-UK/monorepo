"use client";

import { linkedListingLabel } from "@/server/domain/edition-run.vm";
import type { AdminEditionRunDetail } from "@auction/shop-contracts";
import { CellLink, type DataColumn, RelatedRecordsSection } from "@auction/staff-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Listing = AdminEditionRunDetail["linkedListings"][number];

const COLUMNS: readonly DataColumn<Listing>[] = [
  {
    id: "title",
    header: "Listing",
    cell: (row) => (
      <CellLink href={`/artworks/${row.artworkId}`} Link={Link}>
        {row.title}
      </CellLink>
    ),
    mobile: "title",
  },
  {
    id: "kind",
    header: "What it sells",
    cell: (row) => linkedListingLabel(row.spec),
    mobile: "meta",
  },
];

/**
 * A main run's proof and companion listings: separate artworks of the same image, each linked
 * back here. Created from the page's action menu.
 */
export function LinkedListingsCard({
  listings,
}: { listings: AdminEditionRunDetail["linkedListings"] }) {
  const router = useRouter();
  return (
    <RelatedRecordsSection<Listing>
      id="linked-listings"
      title="Linked listings"
      description="Proofs sold on their own, and other runs of the same image."
      columns={COLUMNS}
      data={listings}
      getRowId={(row) => row.artworkId}
      defaultSort={{ columnId: "title", direction: "asc" }}
      onRowOpen={(row) => router.push(`/artworks/${row.artworkId}`)}
      empty={{
        title: "No linked listings",
        description:
          "To sell proofs kept from this run, or an unsigned run of the same image, use Create proof listing or Create companion listing.",
      }}
    />
  );
}
