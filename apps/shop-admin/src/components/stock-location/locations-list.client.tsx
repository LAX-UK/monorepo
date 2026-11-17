"use client";

import { FROM_ZOHO_TITLE, useQueueFrame } from "@/components/from-zoho/use-queue-frame.client";
import { LocationDialog } from "@/components/stock-location/location-dialog.client";
import { LocationStatusDialog } from "@/components/stock-location/location-status-dialog.client";
import { presentStatus } from "@/server/domain/staff-status";
import { LOCATIONS_DESCRIPTION } from "@/server/domain/stock-location.vm";
import type { ZohoQueueQuery } from "@/server/domain/zoho-register.vm";
import type { AdminRegisterCounts, AdminStockLocation } from "@auction/shop-contracts";
import {
  type DataColumn,
  ListPage,
  MappedStatusBadge,
  type OverflowAction,
  PrimaryCell,
  StaffButton,
  StaffDate,
  useStaffCan,
} from "@auction/staff-ui";
import { ArchiveRestore, Pencil, Plus, Archive as Retire } from "@auction/staff-ui/icons";
import { useMemo, useState } from "react";

const MANAGE = "artwork_location.manage";
const presentLocationStatus = presentStatus("stockLocation");

/** The dialog open on the page; a row is named by id so a reload hands it the latest version. */
type Dialog = { kind: "add" } | { kind: "edit"; id: string } | { kind: "status"; id: string };

const COLUMNS: DataColumn<AdminStockLocation>[] = [
  {
    id: "name",
    header: "Location",
    mobile: "title",
    cell: (row) => <PrimaryCell secondary={row.note ?? undefined}>{row.name}</PrimaryCell>,
  },
  {
    id: "status",
    header: "Status",
    width: "120px",
    mobile: "badge",
    truncate: false,
    cell: (row) => <MappedStatusBadge status={row.status} present={presentLocationStatus} />,
  },
  {
    id: "updated",
    header: "Last changed",
    width: "184px",
    hideBelow: "md",
    mobile: "meta",
    truncate: false,
    cell: (row) => <StaffDate value={row.updatedAt} withTime />,
  },
];

/**
 * From Zoho › Locations: the places an original can physically be (docs/design/stock-location.md).
 * Active places first, then retired ones, each by name. Administrators add, rename, retire and
 * restore them, with a recent sign-in; a location has no page, so their row click opens its edit
 * dialog, as Framing and Help categories do. Everyone else who can open From Zoho reads the list.
 */
export function LocationsList({
  query,
  counts,
  unlinked = 0,
  locations,
}: {
  query: ZohoQueueQuery;
  counts: AdminRegisterCounts;
  unlinked?: number;
  /** Every location, retired ones too, in the API's order. */
  locations: readonly AdminStockLocation[];
}) {
  const { pending, ListLink, views } = useQueueFrame(query, counts, unlinked);
  const canManage = useStaffCan(MANAGE);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = () => setDialog(null);
  const open = dialog && dialog.kind !== "add" ? locations.find((l) => l.id === dialog.id) : null;

  const rowActions = useMemo(
    () =>
      (row: AdminStockLocation): OverflowAction[] => [
        {
          id: "edit",
          requires: MANAGE,
          label: "Edit…",
          icon: Pencil,
          onSelect: () => setDialog({ kind: "edit", id: row.id }),
        },
        row.status === "active"
          ? {
              id: "retire",
              requires: MANAGE,
              label: "Retire…",
              icon: Retire,
              onSelect: () => setDialog({ kind: "status", id: row.id }),
            }
          : {
              id: "restore",
              requires: MANAGE,
              label: "Restore…",
              icon: ArchiveRestore,
              onSelect: () => setDialog({ kind: "status", id: row.id }),
            },
      ],
    [],
  );

  const addButton = (variant: "primary" | "secondary") => (
    <StaffButton
      variant={variant}
      requires={MANAGE}
      icon={<Plus aria-hidden />}
      onClick={() => setDialog({ kind: "add" })}
    >
      Add location
    </StaffButton>
  );

  return (
    <>
      <ListPage<AdminStockLocation>
        title={FROM_ZOHO_TITLE}
        description={LOCATIONS_DESCRIPTION}
        Link={ListLink}
        listKey="from-zoho-locations"
        editRequires={MANAGE}
        primaryAction={addButton("primary")}
        views={views}
        loading={pending}
        filtered={false}
        resultCount={`${locations.length} ${locations.length === 1 ? "location" : "locations"}`}
        empty={{
          illustration: "plinth",
          title: "No locations yet",
          description: canManage
            ? 'Add the places originals can be, such as "Gallery, main room", "Store room" or "Framer". Staff then move artworks between them.'
            : "An Administrator adds the places originals can be. They appear here.",
          action: addButton("secondary"),
        }}
        noResults={{ noun: "locations" }}
        table={{
          label: "Locations",
          columns: COLUMNS,
          data: [...locations],
          getRowId: (row) => row.id,
          defaultDensity: "comfortable",
          // No page to open: an Administrator's row opens the edit dialog; other rows open nothing.
          ...(canManage
            ? { onRowOpen: (row: AdminStockLocation) => setDialog({ kind: "edit", id: row.id }) }
            : {}),
          ...(canManage
            ? { rowActions: { label: (row) => `Actions for ${row.name}`, actions: rowActions } }
            : {}),
        }}
      />
      {dialog?.kind === "add" ? <LocationDialog location={null} onClose={close} /> : null}
      {dialog?.kind === "edit" && open ? <LocationDialog location={open} onClose={close} /> : null}
      {dialog?.kind === "status" && open ? (
        <LocationStatusDialog location={open} onClose={close} />
      ) : null}
    </>
  );
}
