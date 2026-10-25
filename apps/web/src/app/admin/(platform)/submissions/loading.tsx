import { ListPageSkeleton } from "@auction/staff-ui";

export default function AdminSubmissionsLoading() {
  return (
    <ListPageSkeleton
      title="Submissions"
      description="Review what sellers send in: accept it for cataloguing or reject it with a reason."
      columns={["Submission", "Status", "Seller", "Waiting", "Details", "Submitted"]}
    />
  );
}
