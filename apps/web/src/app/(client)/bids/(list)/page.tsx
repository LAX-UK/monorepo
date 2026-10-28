import {
  ConditionReportsSection,
  TelephoneBidsSection,
} from "@/app/(client)/bids/bids-extra-sections";
import { BidsPageContent } from "@/app/(client)/bids/bids-page-content";
import { MyBidsMoreMenu } from "@/components/dashboard/bids/my-bids-more-menu";
import { BROWSE_UPCOMING_SALES_HREF } from "@/components/dashboard/bids/my-bids-view";
import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { AccountListSkeleton } from "@/components/dashboard/primitives/account-list-skeleton";
import { DASHBOARD_CTA } from "@/lib/dashboard/dashboard-copy";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = { title: "My bids" };

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function DashboardBidsPage({ searchParams }: PageProps) {
  return (
    <DashboardListPage
      title="My bids"
      description="Your bids in current and past sales. Prices update live."
      actions={
        <div className="flex gap-2 max-md:[&>a]:flex-1">
          <Button variant="secondaryOutline" size="default" asChild>
            <Link href={BROWSE_UPCOMING_SALES_HREF}>{DASHBOARD_CTA.browseUpcomingSales}</Link>
          </Button>
          <MyBidsMoreMenu />
        </div>
      }
    >
      <Suspense fallback={<AccountListSkeleton label="Loading your bids" />}>
        <BidsPageContent searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <TelephoneBidsSection />
      </Suspense>
      <Suspense fallback={null}>
        <ConditionReportsSection />
      </Suspense>
    </DashboardListPage>
  );
}
