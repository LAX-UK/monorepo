import { ListPageSkeleton } from "@auction/staff-ui";

export default function AdminArtistsLoading() {
  return (
    <ListPageSkeleton
      title="Artists"
      description="Canonical artist profiles, their owner accounts and the attribution lots point to."
      columns={["Artist", "Status", "Owner account", "Lots", "Updated"]}
      metrics={4}
    />
  );
}
