import { BidsPageContent } from "@/app/dashboard/bids/bids-page-content";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";
import { Suspense } from "react";

type PageProps = {
  searchParams: Promise<{ tab?: string; q?: string }>;
};

export default function DashboardBidsPage({ searchParams }: PageProps) {
  return (
    <DashboardPage>
      <Suspense fallback={<DashboardSkeleton variant="list" />}>
        <BidsPageContent searchParams={searchParams} />
      </Suspense>
    </DashboardPage>
  );
}
