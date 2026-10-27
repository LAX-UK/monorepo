import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { NoAccess } from "@/components/layout/account-switcher/no-access";
import { safeHopNext } from "@/lib/navigation/account-link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "No access" };

export default async function NoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <DashboardPage>
      <NoAccess next={safeHopNext(next)} />
    </DashboardPage>
  );
}
