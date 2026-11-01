import { ListPageSkeleton } from "@auction/staff-ui";

export default function FailedJobsLoading() {
  return (
    <ListPageSkeleton
      title="Failed jobs"
      description="Background jobs that ran out of attempts. Retry them once the cause is fixed, or discard them with a reason."
      columns={["Job", "Error", "Attempts", "First failed", "Last failed"]}
    />
  );
}
