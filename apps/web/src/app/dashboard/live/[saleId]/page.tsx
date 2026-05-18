import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardDetailHeader } from "@/components/dashboard/primitives/dashboard-detail-header";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { Button } from "@auction/ui/components/button";
import { LiveBadge } from "@auction/ui/components/live-badge";
import { Radio } from "lucide-react";
import Link from "next/link";

type Props = { params: Promise<{ saleId: string }> };

export default async function LiveSaleRoomPage({ params }: Props) {
  const { saleId } = await params;

  return (
    <DashboardPage>
      <DashboardDetailHeader
        track="live"
        eyebrow="Live bidding"
        title="Live sale room"
        description={`Sale ${saleId.slice(0, 8)}… — streaming and clerk controls arrive with hybrid saleroom UX.`}
        badges={<LiveBadge />}
      />
      <DashboardEmptyState
        variant="hero"
        icon={<Radio aria-hidden />}
        title="Live console not connected"
        description="Browse timed auctions on the public site today. We will notify you when this sale opens for live participation."
        action={
          <Button variant="default" asChild>
            <Link href="/search">Browse timed sales</Link>
          </Button>
        }
      />
    </DashboardPage>
  );
}
