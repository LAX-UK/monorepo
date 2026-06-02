"use client";

import { CatalogMobileCardShell } from "@/components/admin/catalog/catalog-mobile-card-shell";
import { CatalogVirtualizedList } from "@/components/admin/catalog/catalog-virtualized-list";
import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { adminArchiveVenueResultAction } from "@/lib/actions/admin-venues";
import type { AdminVenueListRow } from "@/lib/services/interfaces/admin-venue-service";
import { notify } from "@/lib/ui/notify";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { Archive, LayoutGrid, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  venues: AdminVenueListRow[];
};

function statusBadge(venue: AdminVenueListRow) {
  return venue.status === "archived" ? (
    <Badge variant="secondary">Archived</Badge>
  ) : (
    <Badge variant="outline">Active</Badge>
  );
}

function venueAddress(venue: AdminVenueListRow): string {
  return [venue.addressLine1, venue.addressLine2, venue.city, venue.postcode]
    .filter(Boolean)
    .join(", ");
}

function organisationLabel(venue: AdminVenueListRow): string {
  return venue.legalEntityDisplayName?.trim() || "Unknown organisation";
}

export function AdminVenuesBoard({ venues }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmVenue, setConfirmVenue] = useState<AdminVenueListRow | null>(null);
  const [pending, startTransition] = useTransition();

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
                  className="mt-0.5 block font-label text-[10px] uppercase text-primary hover:underline"
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

      <Surface variant="section" padding="md" className="hidden space-y-4 lg:block">
        <div className="space-y-1">
          <h3 className="font-headline text-lg font-semibold text-on-surface">Venue directory</h3>
          <p className="font-body text-sm text-on-surface-variant">
            Reusable onsite locations available to sale setup.
          </p>
        </div>
        <div className="overflow-hidden rounded-lg border border-border-hairline">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Venue
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Organisation
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Address
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-hairline">
              {venues.map((venue) => {
                const rowPending = pending && pendingId === venue.id;
                return (
                  <tr key={venue.id} className="bg-surface-container-lowest/40">
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/admin/venues/${venue.id}`}
                        className="font-headline text-base font-semibold text-primary"
                      >
                        {venue.name}
                      </Link>
                      {venue.slug ? (
                        <p className="mt-1 font-mono text-xs text-on-surface-variant">
                          /{venue.slug}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top text-on-surface-variant">
                      <Link
                        href={`/admin/legal-entities/${venue.legalEntityId}`}
                        className="font-body text-sm text-primary hover:underline"
                      >
                        {organisationLabel(venue)}
                      </Link>
                    </td>
                    <td className="max-w-md px-4 py-3 align-top text-on-surface-variant">
                      {venueAddress(venue)}
                    </td>
                    <td className="px-4 py-3 align-top">{statusBadge(venue)}</td>
                    <td className="px-4 py-3 align-top">
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Surface>

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
