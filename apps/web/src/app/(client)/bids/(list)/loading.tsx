import { AccountPageLoading } from "@/components/dashboard/primitives/account-page-loading";

/** The title depends on the account ("My bids" for a person, "Bids" for an organisation). */
export default function BidsLoading() {
  return <AccountPageLoading label="Loading bids" />;
}
