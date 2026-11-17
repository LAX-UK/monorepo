import { LocationPanel } from "@/components/stock-location/location-panel.client";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminArtworkLocation, AdminStockLocationList } from "@auction/shop-contracts";
import { SectionSkeleton } from "@auction/staff-ui";

/**
 * The Location panel's data, read on the server beside the record and streamed in on its own,
 * so a slow or failed read shows in the panel without holding up or failing the record.
 */
export async function LocationPanelSection({
  registerId,
  title,
}: {
  registerId: string;
  title: string;
}) {
  const [location, list] = await Promise.all([
    fetchAdminJson<AdminArtworkLocation>(
      `artwork-register/${encodeURIComponent(registerId)}/location`,
    ),
    fetchAdminJson<AdminStockLocationList>("artwork-locations"),
  ]);
  return (
    <LocationPanel
      registerId={registerId}
      title={title}
      location={location.status === "ok" ? location.data : null}
      locations={list.status === "ok" ? list.data.items : null}
    />
  );
}

/** The panel's frame while its data loads: a title, the Move button and a few lines. */
export function LocationPanelSkeleton() {
  return <SectionSkeleton rows={[1, 1, 2]} description action />;
}
