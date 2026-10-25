import { ListPageSkeleton } from "@auction/staff-ui";

export default function InvitationsLoading() {
  return (
    <ListPageSkeleton
      title="Invitations"
      description="Invite clients and staff by email. They finish signing up from the link we send."
      columns={["Invitee", "Status", "Access", "Sent", "Expires"]}
    />
  );
}
