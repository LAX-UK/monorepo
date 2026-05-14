import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

type Props = { params: Promise<{ saleId: string }> };

export default async function LiveSaleRoomPage({ params }: Props) {
  const { saleId } = await params;

  return (
    <DashboardPage>
      <PageHeader
        title="Live sale room"
        description={`Sale ${saleId.slice(0, 8)}… — streaming video, paddle state, and outsized bid controls arrive with Phase 3 bidder UX.`}
        className="border-0 pb-0"
      />
      <EmptyState
        title="Live console not connected"
        description="Use the marketing sale page for timed auctions today; hybrid clerk integrations will unlock this surface."
        action={
          <Button variant="default" asChild>
            <Link href="/search">Browse timed sales</Link>
          </Button>
        }
      />
    </DashboardPage>
  );
}
