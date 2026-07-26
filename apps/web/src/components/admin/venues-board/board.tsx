"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { CatalogBoardCard } from "@/components/admin/catalog/catalog-board-card";
import { CatalogBoardTableHeader } from "@/components/admin/catalog/catalog-board-table-header";
import { CatalogMobileCardShell } from "@/components/admin/catalog/catalog-mobile-card-shell";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { CatalogVirtualizedList } from "@/components/admin/catalog/catalog-virtualized-list";
import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { adminArchiveVenueResultAction } from "@/lib/actions/admin-venues";
import type { AdminVenueListRow } from "@/lib/services/interfaces/admin-venue-service";
import { notify } from "@/lib/ui/notify";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import { Archive, LayoutGrid, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type Props = {
  venues: AdminVenueListRow[];
  pagination?: {
    offset: number;
    limit: number;
    countOnPage: number;
    total: number;
    prevHref: string | null;
    nextHref: string | null;
  } | null;
  listTotalCount?: number;
};

function statusBadge(venue: AdminVenueListRow) {
  return <AdminStatusBadge domain="venue" status={venue.status} />;
}

function venueAddress(venue: AdminVenueListRow): string {
  return [venue.addressLine1, venue.addressLine2, venue.city, venue.postcode]
    .filter(Boolean)
    .join(", ");
}

function organisationLabel(venue: AdminVenueListRow): string {
  return venue.legalEntityDisplayName?.trim() || "Unknown organisation";
}

export function AdminVenuesBoard({ venues, pagination, listTotalCount }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmVenue, setConfirmVenue] = useState<AdminVenueListRow | null>(null);
  const [pending, startTransition] = useTransition();
  const headerCount = listTotalCount ?? venues.length;

  const columns = useMemo<ColumnDef<AdminVenueListRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Venue",
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              href={`/admin/venues/${row.original.id}`}
              className="font-headline text-base font-semibold text-primary"
            >
              {row.original.name}
            </Link>
            {row.original.slug ? (
              <p className="mt-1 font-mono text-xs text-on-surface-variant">/{row.original.slug}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: "organisation",
        header: "Organisation",
        cell: ({ row }) => (
          <Link
            href={`/admin/legal-entities/${row.original.legalEntityId}`}
            className="font-body text-sm text-link hover:underline"
          >
            {organisationLabel(row.original)}
          </Link>
        ),
      },
      {
        id: "address",
        header: "Address",
        cell: ({ row }) => (
          <span className="text-on-surface-variant">{venueAddress(row.original)}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => statusBadge(row.original),
      },
      {
        id: "actions",
        header: "Actions",
        enableHiding: false,
        cell: ({ row }) => {
          const venue = row.original;
          const rowPending = pending && pendingId === venue.id;
          return (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/venues/${venue.id}`}>
                  <LayoutGrid className="size-3.5" aria-hidden />
                  View
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/venues/${venue.id}/edit`}>
                  <Pencil className="size-3.5" aria-hidden />
                  Edit
                </Link>
              </Button>
              {venue.status === "active" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={rowPending}
                  onClick={() => setConfirmVenue(venue)}
                >
                  <Archive className="size-3.5" aria-hidden />
                  Archive
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [pending, pendingId],
  );

  function archiveVenue(venue: AdminVenueListRow) {
    startTransition(async () => {
      setPendingId(venue.id);
      const result = await adminArchiveVenueResultAction(venue.id);
      setPendingId(null);
      setConfirmVenue(null);
      if (result.ok) {
        notify.success("Venue archived");
        router.refresh();
        return;
      }
      notify.error(result.error);
    });
  }

  return (
    <>
      <CatalogVirtualizedList className="lg:hidden" itemCount={venues.length}>
        {venues.map((venue) => {
          return (
            <CatalogMobileCardShell
              key={venue.id}
              id={venue.id}
              title={venue.name}
              selectionLabel={`Select ${venue.name}`}
              status={statusBadge(venue)}
              footer={
                <div className="grid gap-2">
                  <Button variant="secondary" size="sm" className="min-h-11 w-full" asChild>
                    <Link href={`/admin/venues/${venue.id}`}>View</Link>
                  </Button>
                  <Button variant="outline" size="sm" className="min-h-11 w-full" asChild>
                    <Link href={`/admin/venues/${venue.id}/edit`}>Edit</Link>
                  </Button>
                  {venue.status === "active" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 w-full"
                      disabled={pending && pendingId === venue.id}
                      onClick={() => setConfirmVenue(venue)}
                    >
                      Archive
                    </Button>
                  ) : null}
                </div>
              }
            >
              <Link
                href={`/admin/venues/${venue.id}`}
                className="font-headline text-sm text-primary"
              >
                {venue.name}
              </Link>
              <p className="mt-1 font-body text-xs text-on-surface-variant">
                {venue.city}, {venue.postcode}
              </p>
              {venue.legalEntityId ? (
                <Link
                  href={`/admin/legal-entities/${venue.legalEntityId}`}
                  className="mt-0.5 block font-label text-[10px] uppercase text-link hover:underline"
                >
                  {organisationLabel(venue)}
                </Link>
              ) : null}
              {venue.slug ? (
                <p className="mt-1 font-label text-[10px] uppercase text-on-surface-variant">
                  /{venue.slug}
                </p>
              ) : null}
            </CatalogMobileCardShell>
          );
        })}
      </CatalogVirtualizedList>
      {pagination ? (
        <div className="lg:hidden">
          <CatalogPagination
            offset={pagination.offset}
            limit={pagination.limit}
            countOnPage={pagination.countOnPage}
            total={pagination.total}
            prevHref={pagination.prevHref}
            nextHref={pagination.nextHref}
          />
        </div>
      ) : null}

      <CatalogBoardCard className="hidden lg:block">
        <CatalogBoardTableHeader
          leading={
            <>
              <div>
                <h2 className="font-headline text-lg font-semibold text-on-surface">
                  Venue directory
                </h2>
                <p className="font-body text-sm text-on-surface-variant">
                  Reusable onsite locations available to sale setup.
                </p>
              </div>
              <Badge
                variant="secondary"
                className="h-6 min-w-6 rounded-full bg-on-surface px-2 font-label text-xs font-semibold text-surface-container-lowest"
              >
                {headerCount > 99 ? "99+" : headerCount}
              </Badge>
            </>
          }
        />
        <AdminDataTable
          ariaLabel="Venue directory"
          columns={columns}
          data={venues}
          getRowId={(venue) => venue.id}
          getRowHref={(venue) => `/admin/venues/${venue.id}`}
          getRowEditHref={(venue) => `/admin/venues/${venue.id}/edit`}
          enableKeyboardNav
          stickyHeader
          showColumnPicker
          columnVisibilityStorageKey="admin-venues-table-columns"
        />
        {pagination ? (
          <CatalogPagination
            offset={pagination.offset}
            limit={pagination.limit}
            countOnPage={pagination.countOnPage}
            total={pagination.total}
            prevHref={pagination.prevHref}
            nextHref={pagination.nextHref}
          />
        ) : null}
      </CatalogBoardCard>

      {confirmVenue ? (
        <TypedConfirmationDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmVenue(null);
          }}
          title="Archive this venue?"
          description="Archived venues remain linked to existing sales, but cannot be selected for new onsite sales."
          actionLabel="Archive venue"
          confirmationPhrase={confirmVenue.slug ?? confirmVenue.name}
          severity="warning"
          onConfirm={() => archiveVenue(confirmVenue)}
        />
      ) : null}
    </>
  );
}
