import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { ArtSearchBrowseCard } from "@/components/search/art-search-browse-card";
import { ArtSearchForm } from "@/components/search/art-search-form";
import { ArtSearchResults } from "@/components/search/art-search-results";
import { artServices } from "@/lib/art-services.server";
import { composeSearchPage } from "@/lib/search/search-page.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import type { Metadata } from "next";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Search | LAX Art",
  robots: { index: false, follow: true },
};

export default async function ArtSearchPage({ searchParams }: SearchPageProps) {
  const vm = await composeSearchPage(artServices, await searchParams);

  if (vm.status === "idle") {
    // The in-page field stays on desktop here: it is the only search input outside the header.
    return (
      <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-10 py-6 lg:py-16")}>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-10">
          <ArtSearchForm defaultValue="" />
          <ArtStatusState
            variant="empty"
            icon="search"
            titleAs="h1"
            title="Search by artist or artwork"
            description="Search across artists, artworks, exhibitions and stories"
          />
          <ArtSearchBrowseCard imageUrl={vm.browseImageUrl} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-8 py-6 lg:py-16")}>
      {/* Figma has no in-page field on desktop results; mobile keeps the pill (`895:18920`). */}
      <ArtSearchForm defaultValue={vm.query} className="lg:hidden" />
      {vm.status === "unavailable" ? (
        <ArtStatusState
          variant="error"
          titleAs="h1"
          title="Search unavailable"
          description="We could not search the catalogue. Try again shortly."
          actions={<ArtStatusStateLink href="/artworks">Browse artworks</ArtStatusStateLink>}
        />
      ) : (
        <ArtSearchResults vm={vm} />
      )}
    </div>
  );
}
