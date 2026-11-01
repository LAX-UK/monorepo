import { ListPageSkeleton } from "@auction/staff-ui";

export default function AdminInboxLoading() {
  return (
    <ListPageSkeleton
      title="Inbox"
      description="Client messages about consignments. Unanswered threads sort by working hours waited."
      columns={["Consignment", "Client", "Last message", "Waiting", "Assignee"]}
    />
  );
}
