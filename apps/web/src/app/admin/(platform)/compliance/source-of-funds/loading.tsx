import { ListPageSkeleton } from "@auction/staff-ui";

export default function AdminComplianceSofLoading() {
  return (
    <ListPageSkeleton
      title="Source of funds"
      description="Settlement is blocked until a pending case is approved by an MLRO, after an analyst's triage. A rejected case keeps blocking until it is reopened."
      metrics={3}
      columns={["Buyer", "Status", "Trigger", "Exposure", "Triage", "Opened"]}
    />
  );
}
