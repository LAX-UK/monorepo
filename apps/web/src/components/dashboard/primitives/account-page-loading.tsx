import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { AccountListSkeleton } from "./account-list-skeleton";

type AccountPageLoadingProps = {
  /**
   * The page's own title, shown at once so only the list is waited for. Leave it out when the
   * title depends on the account (Selling for a person, Consignments for an organisation).
   */
  title?: string;
  label: string;
  shape?: "rows" | "tiles";
  tabs?: boolean;
};

/** A whole account page while it loads: its real title when known, then the list's skeleton. */
export function AccountPageLoading({ title, label, shape, tabs }: AccountPageLoadingProps) {
  const skeleton = (
    <AccountListSkeleton
      label={label}
      {...(shape ? { shape } : {})}
      {...(tabs === undefined ? {} : { tabs })}
    />
  );
  if (!title) return <DashboardPage>{skeleton}</DashboardPage>;
  return <DashboardListPage title={title}>{skeleton}</DashboardListPage>;
}
