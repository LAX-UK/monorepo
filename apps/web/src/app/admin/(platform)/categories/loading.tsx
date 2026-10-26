import { ListPageSkeleton } from "@auction/staff-ui";

export default function AdminCategoriesLoading() {
  return (
    <ListPageSkeleton
      title="Categories"
      description="The taxonomy behind sales, lots and submissions. Archive a category in use instead of deleting it."
      columns={["Category", "Status", "Lots", "Sales", "Submissions", "Updated"]}
      metrics={3}
    />
  );
}
