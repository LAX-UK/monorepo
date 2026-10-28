import { ArtAccountDestinationList } from "@/components/account/art-account-destination-list";
import { ArtAccountListStateView } from "@/components/account/art-account-list-state";
import { ArtAccountPromoCards } from "@/components/account/art-account-promo-cards";
import { ArtAccountPage } from "@/components/account/art-account-shell";
import { ArtEnquiryList } from "@/components/account/art-enquiry-list";
import { ArtSection } from "@/components/layout/art-section";
import { composeArtAccountOverviewPage } from "@/lib/account/account-page.composer";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { artServices } from "@/lib/art-services.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";

export const dynamic = "force-dynamic";
export const metadata = artPrivatePageTitle("Account");

export default async function ArtAccountOverviewPage() {
  const result = await composeArtAccountOverviewPage(artServices);
  return (
    <ArtAccountPage result={result} title="Account" layout="account">
      {(vm) => (
        <div className="mx-auto flex max-w-3xl flex-col gap-12">
          {vm.banner ? (
            <Alert variant="inverse" data-testid="art-account-banner">
              <AlertTitle className="text-base">{vm.banner.title}</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <p>{vm.banner.description}</p>
                {vm.banner.action ? (
                  <Button asChild variant="outline" className="min-h-11 bg-transparent">
                    <a href={vm.banner.action.href}>{vm.banner.action.label}</a>
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <ArtSection
            id="account-enquiries"
            title="Your enquiries"
            {...(vm.moreEnquiries
              ? { viewAllHref: "/account/enquiries", viewAllSrLabel: "enquiries" }
              : {})}
          >
            <ArtAccountListStateView
              state={vm.enquiries}
              empty={{
                title: "No enquiries yet",
                description:
                  "Ask about a work from its page, or write to the gallery. Replies appear here.",
                action: { href: "/artworks", label: "Browse artworks" },
              }}
              failedDescription="We could not load your enquiries. Try again shortly."
            >
              {(items) => <ArtEnquiryList items={items} />}
            </ArtAccountListStateView>
          </ArtSection>

          <ArtAccountDestinationList destinations={vm.destinations} />

          <ArtAccountPromoCards promos={vm.promos} />
        </div>
      )}
    </ArtAccountPage>
  );
}
