import { ListPageSkeleton } from "@auction/staff-ui";

export default function EnquiriesLoading() {
  return (
    <ListPageSkeleton
      title="Enquiries"
      description="Every enquiry from lax.bid. Each gets a reply within two business days."
      columns={["Client", "Kind", "Assignee", "Waiting", "Status"]}
    />
  );
}
