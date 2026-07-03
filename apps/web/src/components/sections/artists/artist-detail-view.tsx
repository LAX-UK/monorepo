import { ViewItemListTracker } from "@/components/analytics/view-item-list-tracker";
import { ArtistScenarioBadges } from "@/components/artists/artist-scenario-badge";
import { ArtistWatchToggle } from "@/components/marketing/artist-watch-toggle";
import { MarketingDetailShell } from "@/components/marketing/marketing-detail-shell";
import { MarketingDetailWayfinding } from "@/components/marketing/marketing-detail-wayfinding";
import { MarketingPromoCta } from "@/components/marketing/marketing-promo-cta";
import { ShareButton } from "@/components/marketing/share-button";
import { ArtistHero } from "@/components/sections/artists/artist-hero";
import { ArtistRelatedDirectorySection } from "@/components/sections/artists/artist-related-directory-section";
import { ArtistStickyFollow } from "@/components/sections/artists/artist-sticky-follow";
import { ArtistWorksEmptyState } from "@/components/sections/artists/artist-works-empty-state";
import { ArtistWorksGrid } from "@/components/sections/artists/artist-works-grid";
import type { ArtistDetailPageData } from "@/lib/marketing/load-artist-detail-page";
import { Badge, Button } from "@auction/ui";
import Link from "next/link";

type ArtistDetailViewProps = ArtistDetailPageData;

export function ArtistDetailView({ vm, jsonLdText, noIndex }: ArtistDetailViewProps) {
  const scenarioStrip = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ArtistScenarioBadges
          kind={vm.registry.kind ?? null}
          featured={vm.isFeatured}
          verified={vm.registry.verified ?? false}
          deathYear={vm.registry.deathYear ?? null}
        />
        {vm.aliasesList.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
              Also known as
            </span>
            {vm.aliasesList.map((a) => (
              <Badge key={a} variant="outline" className="text-xs">
                {a}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      {vm.categoryChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
            Departments
          </span>
          {vm.categoryChips.map((c) => (
            <Link
              key={c.id}
              href={`/artists?category=${encodeURIComponent(c.slug)}`}
              aria-label={`Browse ${vm.kindConfig.pluralLabel.toLowerCase()} in ${c.name}`}
              className="rounded-full border border-outline-variant/40 bg-surface-container-low px-3 py-1 font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant transition-colors hover:border-link/40 hover:bg-surface-container-high hover:text-link"
            >
              {c.name}
            </Link>
          ))}
        </div>
      ) : null}
      {vm.pivotChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
            Browse similar
          </span>
          {vm.pivotChips.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              aria-label={c.aria}
              className="rounded-full border border-outline-variant/40 bg-surface-container-low px-3 py-1 font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant transition-colors hover:border-link/40 hover:bg-surface-container-high hover:text-link"
            >
              {c.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <MarketingDetailShell
      jsonLd={
        <>
          <script type="application/ld+json" suppressHydrationWarning>
            {jsonLdText}
          </script>
          {noIndex ? <meta name="robots" content="noindex,follow" /> : null}
        </>
      }
      wayfinding={
        <MarketingDetailWayfinding
          backHref={vm.directoryBackHref}
          backLabel="Back to artists"
          breadcrumbItems={vm.breadcrumbItems}
          className="mb-8"
        />
      }
      stickyChrome={
        <ArtistStickyFollow
          artistId={vm.id}
          artistName={vm.artistName}
          initialWatching={vm.watching}
          isAuthenticated={vm.isAuthed}
          loginNextPath={vm.profilePath}
        />
      }
    >
      <ArtistHero
        vm={{
          id: vm.id,
          name: vm.artistName,
          tagline: vm.artistTagline,
          bio: vm.artistBio,
          portraitUrl: vm.artistPortraitUrl,
          featured: vm.isFeatured,
        }}
        actions={
          <div className="flex flex-col gap-4">
            {scenarioStrip}
            <div className="flex flex-wrap items-center gap-3">
              <ArtistWatchToggle
                artistId={vm.id}
                initialWatching={vm.watching}
                isAuthenticated={vm.isAuthed}
                loginNextPath={vm.profilePath}
              />
              <ShareButton url={vm.profileUrl} title={vm.artistName} />
              {vm.registry.websiteUrl ? (
                <a
                  href={vm.registry.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
                >
                  Official website
                </a>
              ) : null}
            </div>
          </div>
        }
      />
      {vm.attributeRows.length > 0 ? (
        <section className="mb-20">
          <h2 className="mb-6 font-label text-[0.65rem] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            {vm.kindConfig.label} details
          </h2>
          <dl className="grid grid-cols-1 gap-y-5 border-y border-outline-variant/40 py-8 sm:grid-cols-2 md:grid-cols-3">
            {vm.attributeRows.map((row) => (
              <div key={row.label} className="flex flex-col gap-1 px-0 md:pr-5">
                <dt className="font-label text-[0.65rem] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                  {row.label}
                </dt>
                <dd className="font-headline text-lg text-on-surface">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      <section id="works">
        {vm.artistLots.length === 0 ? (
          <ArtistWorksEmptyState />
        ) : (
          <>
            <ViewItemListTracker
              listId={`artist:${vm.id}`}
              listName="Artist works"
              itemIds={vm.artistLots.map((l) => l.id)}
            />
            <ArtistWorksGrid lots={vm.artistLots} currentUserId={vm.currentUserId} />
          </>
        )}
      </section>
      <ArtistRelatedDirectorySection
        rows={vm.relatedRows}
        watchSet={new Set(vm.watchedArtistIds)}
        isAuthenticated={vm.isAuthed}
        browseHref={vm.browseHref}
      />

      <MarketingPromoCta
        className="mt-12"
        title="Submit your portfolio"
        description="Request a valuation or submit work to be considered for an upcoming auction."
        actions={
          <>
            <Button variant="cta" asChild>
              <Link href="/dashboard/submissions/new">Submit work</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/sell">Selling guide</Link>
            </Button>
          </>
        }
      />
    </MarketingDetailShell>
  );
}
