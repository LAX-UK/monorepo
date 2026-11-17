"use client";

import { useLocationWrite } from "@/components/stock-location/use-location-write.client";
import { setStockLocationStatus } from "@/server/application/admin-stock-location-actions.server";
import type { AdminStockLocation } from "@auction/shop-contracts";
import { ConfirmActionDialog } from "@auction/staff-ui";

/**
 * Retire a location, or restore a retired one. Asks first, since retiring changes where staff can
 * move artworks. Retiring deletes nothing: artworks there keep it as their location and every
 * move that names it still reads it, marked "(retired)".
 */
export function LocationStatusDialog({
  location,
  onClose,
}: {
  location: AdminStockLocation;
  onClose: () => void;
}) {
  const write = useLocationWrite();
  const retire = location.status === "active";
  return (
    <>
      <ConfirmActionDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={retire ? `Retire ${location.name}?` : `Restore ${location.name}?`}
        description={
          retire
            ? "No artwork can be moved here once it is retired. Artworks already here keep it as their location, and their history still names it."
            : "Staff can move artworks here again."
        }
        confirmLabel={retire ? "Retire location" : "Restore location"}
        loading={write.pending}
        onConfirm={async () => {
          const ok = await write.run(
            () =>
              setStockLocationStatus({
                locationId: location.id,
                expectedVersion: location.version,
                status: retire ? "retired" : "active",
                idempotencyKey: write.idempotencyKey,
              }),
            retire ? `${location.name} retired` : `${location.name} restored`,
            retire ? "retire this location" : "restore this location",
          );
          if (ok) onClose();
        }}
      >
        {write.error}
      </ConfirmActionDialog>
      {write.stepUpDialog}
    </>
  );
}
