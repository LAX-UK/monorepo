import { ArtAccountListStateView } from "@/components/account/art-account-list-state";
import { ArtAccountPage } from "@/components/account/art-account-shell";
import { composeArtAccountEnquiriesPage } from "@/lib/account/account-page.composer";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { artServices } from "@/lib/art-services.server";
import { MarketingEnquiryListItem } from "@auction/marketing-ui";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";

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
            {(items) => (
              <ul data-testid="art-account-enquiries">
                {items.map((item) => (
                  <li key={item.id}>
                    <MarketingEnquiryListItem
                      variant={item.variant}
                      typeLabel={item.typeLabel}
                      title={item.title}
                      description={item.description}
                      href={item.href}
                      status={
                        item.status ? (
                          <DotStatusPill label={item.status.label} tone={item.status.tone} />
                        ) : null
                      }
                      date={<time dateTime={item.createdAtIso}>{item.createdAtLabel}</time>}
                    />
                  </li>
                ))}
              </ul>
            )}
          </ArtAccountListStateView>
        </section>
      )}
    </ArtAccountPage>
  );
}
