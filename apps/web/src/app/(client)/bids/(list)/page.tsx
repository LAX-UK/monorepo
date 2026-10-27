import {
  ConditionReportsSection,
  TelephoneBidsSection,
} from "@/app/(client)/bids/bids-extra-sections";
import { BidsPageContent } from "@/app/(client)/bids/bids-page-content";
import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";
import { Suspense } from "react";

type PageProps = {
  searchParams: Promise<{ tab?: string; q?: string }>;
};

export default async function DashboardBidsPage({ searchParams }: PageProps) {
  return (
    <DashboardListPage
      title="My bids"
      description="Track active, won, and lost lots with your latest bid values."
    >
      <Suspense fallback={<DashboardSkeleton variant="list" />}>
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
