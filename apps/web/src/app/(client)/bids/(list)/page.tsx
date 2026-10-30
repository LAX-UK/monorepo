import {
  ConditionReportsSection,
  TelephoneBidsSection,
} from "@/app/(client)/bids/bids-extra-sections";
import { BidsPageContent } from "@/app/(client)/bids/bids-page-content";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { WorkspacePageNoAccess } from "@/components/organisations/workspace-page-no-access";
import { ListSkeleton } from "@/components/workspace/list-states";
import { buyingPageView } from "@/lib/buying/buying-pages";
import { getServerDataContainer } from "@/lib/data/container.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { Metadata } from "next";
import { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const scope = await (await getServerDataContainer()).buying.scope();
  const view = buyingPageView(scope, "bids");
  return { title: view.kind === "open" ? view.title : "Bids" };
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
    <>
      <SetMobileShellTitle title={view.title} />
      <Suspense fallback={<ListSkeleton label="Loading bids" />}>
        <BidsPageContent
          searchParams={searchParams}
          title={view.title}
          description={view.description}
          offersSales={view.offersSales}
        >
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
        </BidsPageContent>
      </Suspense>
    </>
  );
}
