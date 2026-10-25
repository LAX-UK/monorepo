import { ListPageSkeleton } from "@auction/staff-ui";

export default function LegalEntitiesLoading() {
  return (
    <ListPageSkeleton
      title="Legal entities"
      description="Organisations and individuals that sell on the platform. Filter by status, kind or Stripe requirements."
      metrics={4}
      columns={["Name", "Status", "Kind", "Stripe", "Updated"]}
    />
  );
}
