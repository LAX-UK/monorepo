import { AccountPageLoading } from "@/components/dashboard/primitives/account-page-loading";

export default function InvitationsLoading() {
  return (
    <AccountPageLoading
      title="Invitations"
      label="Loading your invitations"
      shape="rows"
      tabs={false}
    />
  );
}
