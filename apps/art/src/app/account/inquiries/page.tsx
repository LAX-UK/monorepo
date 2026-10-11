import { ArtAccountListStateView } from "@/components/account/art-account-list-state";
import { ArtAccountPage } from "@/components/account/art-account-shell";
import { composeArtAccountInquiriesPage } from "@/lib/account/account-page.composer";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { artServices } from "@/lib/art-services.server";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = artPrivatePageTitle("Inquiries");

export default async function ArtAccountInquiriesPage() {
  const result = await composeArtAccountInquiriesPage(artServices);
  return (
    <ArtAccountPage result={result} title="Inquiries">
      {(vm) => (
        <ArtAccountListStateView
          state={vm.enquiries}
          empty={{
            title: "No inquiries yet",
            description: "Enquiries you send from an artwork page appear here.",
            action: { href: "/artworks", label: "Browse artworks" },
          }}
          failedDescription="We could not load your inquiries. Try again shortly."
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
      )}
    </ArtAccountPage>
  );
}
