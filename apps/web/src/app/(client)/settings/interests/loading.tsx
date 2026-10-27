import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { Skeleton } from "@auction/ui/components/skeleton";

export default function AuctionInterestsSettingsLoading() {
  return (
    <DashboardPage className="space-y-8">
      <SettingsFormHeader title="Auction interests" />
      <Skeleton className="h-40 w-full" />
    </DashboardPage>
  );
}
