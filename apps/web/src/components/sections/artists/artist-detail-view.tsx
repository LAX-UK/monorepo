import { ArtistBadges } from "@/components/marketing/artist-badges";
import { ArtistPortraitFrame } from "@/components/marketing/artist-portrait-frame";
import { ArtistWatchToggle } from "@/components/marketing/artist-watch-toggle";
import { MarketingDetailShell } from "@/components/marketing/marketing-detail-shell";
import { MarketingDetailWayfinding } from "@/components/marketing/marketing-detail-wayfinding";
import { MarketingPromoCta } from "@/components/marketing/marketing-promo-cta";
import { ShareButton } from "@/components/marketing/share-button";
import { ArtistRelatedDirectorySection } from "@/components/sections/artists/artist-related-directory-section";
import { ArtistStickyFollow } from "@/components/sections/artists/artist-sticky-follow";
import { ArtistWorksSection } from "@/components/sections/artists/artist-works-section";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import type { ArtistDetailPageData } from "@/lib/marketing/load-artist-detail-page";
import {
  MarketingArtistFacts,
  MarketingArtistHero,
  MarketingReadMore,
  marketingArtistFacts,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { ButtonLink } from "@auction/ui/lax";
import Link from "next/link";

type ArtistDetailViewProps = ArtistDetailPageData;

const PIVOT_CHIP = cn(
  "inline-flex min-h-9 items-center rounded-full px-3 font-body text-sm text-on-surface-variant ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low hover:text-on-surface motion-reduce:transition-none",
  FOCUS_RING,
);

/** Kinds that read as organisations rather than people get a badge naming the kind. */
const KIND_BADGE_KINDS = new Set(["brand", "marque", "maker", "studio", "manufacturer", "mint"]);

export function ArtistDetailView({ vm, jsonLdText }: ArtistDetailViewProps) {
  const kind = vm.registry.kind ?? null;
  const kindLabel = kind && KIND_BADGE_KINDS.has(kind) ? artistKindMeta(kind).badge : null;
  const facts = marketingArtistFacts({
    nationality: vm.registry.nationality,
    birthYear: vm.registry.birthYear,
    deathYear: vm.registry.deathYear,
  });
  const relatedLinks = [
    ...vm.categoryChips.map((c) => ({
      key: `category-${c.id}`,
      href: `/artists?category=${encodeURIComponent(c.slug)}`,
      label: c.name,
    })),
    ...vm.pivotChips.map((c) => ({ key: c.href, href: c.href, label: c.label })),
  ];
  /** Same image order as the directory card, so the profile matches the card it came from. */
  const portraitSrc = vm.artistPortraitUrl ?? (vm.registry.heroImageUrl?.trim() || null);

  return (
    <MarketingDetailShell
      jsonLd={
        <script type="application/ld+json" suppressHydrationWarning>
          {jsonLdText}
        </script>
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
      <MarketingArtistHero
        className="mb-16 md:mb-20"
        name={vm.artistName}
        {...(vm.isFeatured ? { eyebrow: "Featured artist" } : {})}
        facts={
          <>
            <MarketingArtistFacts facts={facts} />
            {vm.aliasesList.length > 0 ? (
              <p className="font-body text-sm leading-5 text-on-surface-variant">
                Also known as {vm.aliasesList.join(", ")}
              </p>
            ) : null}
          </>
        }
        badges={
          vm.registry.verified || kindLabel ? (
            <ArtistBadges verified={vm.registry.verified} kindLabel={kindLabel} />
          ) : null
        }
        summary={
          vm.artistBio ? (
            <MarketingReadMore lines={5}>
              <p className="whitespace-pre-line">{vm.artistBio}</p>
            </MarketingReadMore>
          ) : null
        }
        actions={
          <>
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
                className={cn(
                  "inline-flex min-h-11 items-center rounded-sm font-body text-sm font-medium text-link underline-offset-4 hover:underline",
                  FOCUS_RING,
                )}
              >
                Official website<span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : null}
          </>
        }
        portrait={
          portraitSrc ? (
            <ArtistPortraitFrame
              src={portraitSrc}
              alt={`Portrait of ${vm.artistName}`}
              label="Artist portrait"
              sizes="(max-width: 768px) 18rem, 40vw"
            />
          ) : null
        }
      />

      {vm.attributeRows.length > 0 ? (
        <section className="mb-16" aria-labelledby="artist-details-heading">
          <h2
            id="artist-details-heading"
            className="mb-6 font-headline text-xl font-medium text-on-surface"
          >
            {vm.kindConfig.label} details
          </h2>
          <dl className="grid grid-cols-1 gap-y-5 border-y border-border-hairline py-8 sm:grid-cols-2 md:grid-cols-3">
            {vm.attributeRows.map((row) => (
              <div key={row.label} className="flex flex-col gap-1 md:pr-5">
                <dt className="font-body text-sm text-on-surface-variant">{row.label}</dt>
                <dd className="font-headline text-lg text-on-surface">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <ArtistWorksSection
        artistId={vm.id}
        artistName={vm.artistName}
        profilePath={vm.profilePath}
        works={vm.works}
        activeTab={vm.activeWorksTab}
        currentUserId={vm.currentUserId}
        watching={vm.watching}
        isAuthenticated={vm.isAuthed}
      />

      {relatedLinks.length > 0 ? (
        <nav aria-label="Browse similar artists" className="mt-12 flex flex-col gap-3">
          <p className="font-body text-sm font-medium text-on-surface">Browse similar</p>
          <ul className="flex flex-wrap gap-2">
            {relatedLinks.map((link) => (
              <li key={link.key}>
                <Link href={link.href} className={PIVOT_CHIP}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

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
            <ButtonLink Link={Link} variant="primary" href="/selling/new">
              Submit work
            </ButtonLink>
            <ButtonLink Link={Link} variant="secondary" href="/sell">
              Selling guide
            </ButtonLink>
          </>
        }
      />
    </MarketingDetailShell>
  );
}
