import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

export default function LiveBiddingHubPage() {
  return (
    <DashboardPage>
      <PageHeader
        title="Live bidding"
        description="Follow sales with countdown timers, paddle status, and one-tap bidding once streaming integrates."
        className="border-0 pb-0"
      />
      <EmptyState
        title="No live sales linked yet"
        description="When you register for an onsite or hybrid auction, active rooms surface here with deep links like /dashboard/live/[saleId]."
        action={
          <Button variant="default" asChild>
            <Link href="/search">Browse sales</Link>
          </Button>
        }
      />
    </DashboardPage>
  );
}
