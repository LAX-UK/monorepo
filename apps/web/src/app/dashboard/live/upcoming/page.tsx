import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

export default function LiveBiddingHubPage() {
  return (
    <DashboardPage>
      <DashboardPageHeader
        meta="Live bidding"
        title="Live bidding"
        description="Follow sales with countdown timers and one-tap entry when streaming integrates."
      />
      <DashboardEmptyState
        title="No live sales linked yet"
        description="When you register for an onsite or hybrid auction, active rooms surface here with links like /dashboard/live/[saleId]."
        action={
          <Button variant="default" asChild>
            <Link href="/search">Browse sales</Link>
          </Button>
        }
      />
    </DashboardPage>
  );
}
