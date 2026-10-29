import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { AccountsUnavailable } from "@/components/layout/account-switcher/accounts-unavailable";
import { safeRetryTarget } from "@/lib/navigation/account-link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your accounts" };

/**
 * Where a switch, a restore or a record link lands when the person's accounts could not be read.
 * Nothing was changed; "Try again" repeats the step that failed.
 */
export default async function AccountsUnavailablePage({
  searchParams,
}: {
  searchParams: Promise<{ retry?: string | string[] }>;
}) {
  const { retry } = await searchParams;
  return (
    <DashboardPage>
      <AccountsUnavailable
        retry={{ kind: "link", href: safeRetryTarget(Array.isArray(retry) ? retry[0] : retry) }}
      />
    </DashboardPage>
  );
}
