import { ArtAccountListStateView } from "@/components/account/art-account-list-state";
import { ArtAccountPage } from "@/components/account/art-account-shell";
import { ArtEnquiryList } from "@/components/account/art-enquiry-list";
import { composeArtAccountEnquiriesPage } from "@/lib/account/account-page.composer";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { artServices } from "@/lib/art-services.server";

export const dynamic = "force-dynamic";
export const metadata = artPrivatePageTitle("Enquiries");

export default async function ArtAccountEnquiriesPage() {
  const result = await composeArtAccountEnquiriesPage(artServices);
  return (
    <ArtAccountPage result={result} title="Enquiries" layout="account">
      {(vm) => (
        <section aria-label="Your enquiries" className="mx-auto max-w-3xl">
          <ArtAccountListStateView
            state={vm.enquiries}
            empty={{
              title: "No enquiries yet",
              description:
                "Enquiries you send from an artwork page, or through Contact, appear here.",
              action: { href: "/artworks", label: "Browse artworks" },
            }}
            failedDescription="We could not load your enquiries. Try again shortly."
          >
            {(items) => <ArtEnquiryList items={items} />}
          </ArtAccountListStateView>
        </section>
      )}
    </ArtAccountPage>
  );
}
