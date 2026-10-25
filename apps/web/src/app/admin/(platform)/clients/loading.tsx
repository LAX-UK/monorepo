import { ListPageSkeleton } from "@auction/staff-ui";

export default function ClientsLoading() {
  return (
    <ListPageSkeleton
      title="Clients"
      description="Collector and seller accounts. Open a client to see their activity, identity checks and account controls."
      columns={["Client", "Account", "Identity", "Signed up as", "Joined"]}
    />
  );
}
