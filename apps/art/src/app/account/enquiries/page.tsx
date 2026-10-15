import { ArtAccountListStateView } from "@/components/account/art-account-list-state";
import { ArtAccountPage } from "@/components/account/art-account-shell";
import { composeArtAccountInquiriesPage } from "@/lib/account/account-page.composer";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { artServices } from "@/lib/art-services.server";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = artPrivatePageTitle("Enquiries");

export default async function ArtAccountInquiriesPage() {
  const result = await composeArtAccountInquiriesPage(artServices);
  return (
    <ArtAccountPage result={result} title="Enquiries">
      {(vm) => (
        <div className="flex flex-col gap-10">
          <section aria-labelledby="artwork-enquiries-heading" className="flex flex-col gap-4">
            <h2
              id="artwork-enquiries-heading"
              className="font-headline text-lg font-semibold text-on-surface"
            >
              Artwork enquiries
            </h2>
            <ArtAccountListStateView
              state={vm.enquiries}
              empty={{
                title: "No artwork enquiries yet",
                description: "Enquiries you send from an artwork page appear here.",
                action: { href: "/artworks", label: "Browse artworks" },
              }}
              failedDescription="We could not load your artwork enquiries. Try again shortly."
            >
              {(rows) => (
                <ul className="divide-y divide-border-hairline rounded-lg border border-border-hairline">
                  {rows.map((row) => (
                    <li key={row.id} className="flex flex-col gap-1 px-4 py-4">
                      <Link
                        href={row.artworkHref}
                        className="art-focus-ring w-fit rounded-sm font-medium text-on-surface hover:underline"
                      >
                        {row.artworkTitle}
                      </Link>
                      <p className="text-sm capitalize text-on-surface-variant">
                        {row.statusLabel} ·{" "}
                        <time dateTime={row.createdAtIso}>{row.createdAtLabel}</time>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </ArtAccountListStateView>
          </section>

          <section aria-labelledby="general-enquiries-heading" className="flex flex-col gap-4">
            <h2
              id="general-enquiries-heading"
              className="font-headline text-lg font-semibold text-on-surface"
            >
              General enquiries
            </h2>
            <ArtAccountListStateView
              state={vm.generalEnquiries}
              empty={{
                title: "No general enquiries yet",
                description: "Messages you send from Contact appear here.",
                action: { href: "/contact", label: "Contact the gallery" },
              }}
              failedDescription="We could not load your general enquiries. Try again shortly."
            >
              {(rows) => (
                <ul className="divide-y divide-border-hairline rounded-lg border border-border-hairline">
                  {rows.map((row) => (
                    <li key={row.id} className="flex flex-col gap-1 px-4 py-4">
                      <p className="font-medium capitalize text-on-surface">{row.topicLabel}</p>
                      <p className="text-sm text-on-surface-variant">{row.messagePreview}</p>
                      <p className="text-sm text-on-surface-variant">
                        <time dateTime={row.createdAtIso}>{row.createdAtLabel}</time>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </ArtAccountListStateView>
          </section>
        </div>
      )}
    </ArtAccountPage>
  );
}
