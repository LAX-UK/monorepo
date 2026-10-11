import { ArtAccountListStateView } from "@/components/account/art-account-list-state";
import { ArtAccountPage } from "@/components/account/art-account-shell";
import { composeArtAccountCollectionPage } from "@/lib/account/account-page.composer";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { artServices } from "@/lib/art-services.server";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = artPrivatePageTitle("Collection");

export default async function ArtAccountCollectionPage() {
  const result = await composeArtAccountCollectionPage(artServices);
  return (
    <ArtAccountPage result={result} title="Collection">
      {(vm) => (
        <ArtAccountListStateView
          state={vm.collection}
          empty={{
            title: "No works yet",
            description: "Originals and editions you own from lax.art and LAX Shop appear here.",
            action: { href: "/artworks", label: "Browse artworks" },
          }}
          failedDescription="We could not load your collection. Try again shortly."
        >
          {(rows) => (
            <ul className="divide-y divide-border-hairline rounded-lg border border-border-hairline">
              {rows.map((row) => (
                <li key={row.key} className="flex flex-col gap-1 px-4 py-4">
                  {row.href ? (
                    <Link
                      href={row.href}
                      className="art-focus-ring w-fit rounded-sm font-medium text-on-surface hover:underline"
                    >
                      {row.title}
                    </Link>
                  ) : (
                    <p className="font-medium text-on-surface">{row.title}</p>
                  )}
                  <p className="text-sm text-on-surface-variant">
                    {row.kindLabel} · {row.sourceLabel}
                    {row.detail ? ` · ${row.detail}` : ""}
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
