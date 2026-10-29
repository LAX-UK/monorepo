import {
  ConditionReportsSection,
  TelephoneBidsSection,
} from "@/app/(client)/bids/bids-extra-sections";
import { BidsPageContent } from "@/app/(client)/bids/bids-page-content";
import { MyBidsMoreMenu } from "@/components/dashboard/bids/my-bids-more-menu";
import { BROWSE_UPCOMING_SALES_HREF } from "@/components/dashboard/bids/my-bids-view";
import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { AccountListSkeleton } from "@/components/dashboard/primitives/account-list-skeleton";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { WorkspacePageNoAccess } from "@/components/organisations/workspace-page-no-access";
import { buyingPageView } from "@/lib/buying/buying-pages";
import { DASHBOARD_CTA } from "@/lib/dashboard/dashboard-copy";
import { getServerDataContainer } from "@/lib/data/container.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const scope = await (await getServerDataContainer()).buying.scope();
  const view = buyingPageView(scope, "bids");
  return { title: view.kind === "open" ? view.title : "Bids" };
}

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function DashboardBidsPage({ searchParams }: PageProps) {
  const scope = await (await getServerDataContainer()).buying.scope();
  const view = buyingPageView(scope, "bids");
  if (view.kind === "forbidden") {
    return (
      <>
        <SetMobileShellTitle title={view.label} />
        <WorkspacePageNoAccess
          label={view.label}
          openedBy={view.openedBy}
          next={CLIENT_ROUTES.bids}
        />
      </>
    );
  }
  // Telephone bookings and condition reports are the person's own requests, not the account's.
  const personal = scope.account.kind === "personal";
  return (
    <DashboardListPage
      title={view.title}
      description={view.description}
      actions={
        <div className="flex gap-2 max-md:[&>a]:flex-1">
          <Button variant="secondaryOutline" size="default" asChild>
            <Link href={BROWSE_UPCOMING_SALES_HREF}>{DASHBOARD_CTA.browseUpcomingSales}</Link>
          </Button>
          <MyBidsMoreMenu />
        </div>
      }
    >
      <SetMobileShellTitle title={view.title} />
      <Suspense fallback={<AccountListSkeleton label="Loading bids" />}>
        <BidsPageContent searchParams={searchParams} />
      </Suspense>
      {personal ? (
        <>
          <Suspense fallback={null}>
            <TelephoneBidsSection />
          </Suspense>
          <Suspense fallback={null}>
            <ConditionReportsSection />
          </Suspense>
        </>
      ) : null}
    </DashboardListPage>
  );
}
