import { ListPageSkeleton } from "@auction/staff-ui";

export default function StaffLoading() {
  return (
    <ListPageSkeleton
      title="Staff"
      description="Everyone who works in the staff tools, their role and the LAX tools they can use."
      columns={["Staff member", "Account", "Staff role", "LAX access", "Last sign-in"]}
    />
  );
}
