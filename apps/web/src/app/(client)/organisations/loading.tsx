import { AccountPageLoading } from "@/components/dashboard/primitives/account-page-loading";

export default function OrganisationsLoading() {
  return (
    <AccountPageLoading
      title="Your organisations"
      label="Loading your accounts"
      shape="rows"
      tabs={false}
    />
  );
}
