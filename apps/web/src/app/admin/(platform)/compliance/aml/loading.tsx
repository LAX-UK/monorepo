import { ListPageSkeleton } from "@auction/staff-ui";

export default function AdminComplianceAmlLoading() {
  return (
    <ListPageSkeleton
      title="AML screening"
      description="Watchlist matches awaiting review. An analyst recommends a clear or a block, then a different MLRO decides; clearing lifts the settlement hold."
      metrics={4}
      views={false}
      columns={["Client", "Match", "Policy outcome", "Triage", "Hits", "Screened"]}
    />
  );
}
