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
import {
  kindDirectorySlug,
  normalizeDecadeSegment,
  slugifyNationality,
} from "@/lib/artists/directory-presets";
import { loadRelatedDirectoryArtists } from "@/lib/artists/related-directory-artists.server";
import { getServerMyArtistWatchIds } from "@/lib/data/http/artist-watchlist.server";
import {
  fetchPublicArtistAliases,
  fetchRegistryArtistById,
  portraitForPublicArtist,
} from "@/lib/data/http/artist.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { artistDirectoryBackHref } from "@/lib/marketing/catalog-links";
import { metadataForNotFound, metadataForSeller } from "@/lib/seo/metadata-factory";
import {
  breadcrumbJsonLd,
  creatorJsonLd,
  itemListJsonLd,
  jsonLdScript,
} from "@/lib/seo/structured-data";
import { artistPath, lotPath, slugify } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import { getCreatorKindConfig } from "@auction/types";
import type { Lot, ArtistProfile as RegistryArtist } from "@auction/types";
import { Badge, Button } from "@auction/ui";
import { appendMarketingParamsToPath } from "@auction/validators";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function loadArtistLots(artistId: string): Promise<Lot[]> {
  const auctionReader = await getServerLotReader();
  try {
    const [active, scheduled, ended] = await Promise.all([
      auctionReader.list({
        artistId,
        status: "active",
        limit: 24,
        offset: 0,
        sort: "endingAsc",
      }),
      auctionReader.list({
        artistId,
        status: "scheduled",
        limit: 24,
        offset: 0,
        sort: "endingAsc",
      }),
      auctionReader.list({
        artistId,
        status: "ended",
        limit: 24,
        offset: 0,
        sort: "endedDesc",
      }),
    ]);
    return [...active, ...scheduled, ...ended];
  } catch {
    return [];
  }
}

function ensureCanonicalArtistSlug(
  slug: string,
  artist: { id: string; name: string },
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  if (slug !== slugify(artist.name)) {
    permanentRedirect(appendMarketingParamsToPath(artistPath(artist), searchParams));
  }
}

/** `noindex` for any registry artist that shouldn't be ranked: merged, archived, rejected. */
function shouldNoIndex(registry: RegistryArtist | null): boolean {
  if (!registry) return false;
  if (registry.archived) return true;
  if (registry.status === "merged_into" || registry.status === "rejected") return true;
  return false;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id, slug } = await params;
  const sp = await searchParams;
  const registry = await fetchRegistryArtistById(id);
  if (!registry) return metadataForNotFound("Artist not found");
  ensureCanonicalArtistSlug(slug, { id: registry.id, name: registry.displayName }, sp);
  const base = metadataForSeller({ id: registry.id, name: registry.displayName });
  if (shouldNoIndex(registry)) {
    return { ...base, robots: { index: false, follow: true } };
  }
  return base;
}

export default async function ArtistPage({ params, searchParams }: PageProps) {
  const { id, slug } = await params;
  const sp = await searchParams;
  const directoryBackHref = artistDirectoryBackHref(sp);
  const [artistLots, registry, aliases, session, watchedArtistIds] = await Promise.all([
    loadArtistLots(id),
    fetchRegistryArtistById(id),
    fetchPublicArtistAliases(id),
    getServerSessionUser(),
    getServerMyArtistWatchIds(),
  ]);
  if (!registry) notFound();

  const artistName = registry.displayName;
  const artistTagline = registry.nationality?.trim() || null;
  const artistBio = registry.shortBio?.trim() || registry.longBio?.trim() || null;
  const artistPortraitUrl = portraitForPublicArtist(registry.portraitUrl);
  const currentUserId = session?.id ?? null;
  const base = getSiteUrl();
  const isFeatured = registry.featured === true;
  const watching = watchedArtistIds.includes(id);
  const isAuthed = Boolean(session);

  ensureCanonicalArtistSlug(slug, { id: registry.id, name: artistName }, sp);
  const profilePath = artistPath({ id: registry.id, name: artistName });
  const profileUrl = `${base}${profilePath}`;

  const kindConfig = getCreatorKindConfig(registry.kind);
  const aliasesList = aliases.slice(0, 6);

  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Artists", path: "/artists" },
    { name: artistName, path: profilePath },
  ]);

  const description: string | undefined =
    (artistTagline ?? artistBio) ? ((artistTagline ?? artistBio) as string) : undefined;
  const sameAs = registry.websiteUrl ? [registry.websiteUrl] : undefined;

  const subjectLd = creatorJsonLd({
    kind: registry.kind ?? null,
    name: artistName,
    url: profileUrl,
    ...(artistPortraitUrl ? { image: artistPortraitUrl } : {}),
    ...(description ? { description } : {}),
    ...(sameAs ? { sameAs } : {}),
    ...(aliasesList.length > 0 ? { alternateName: aliasesList } : {}),
    ...(registry.birthYear ? { birthDate: registry.birthYear } : {}),
    ...(registry.deathYear ? { deathDate: registry.deathYear } : {}),
    ...(registry.foundedYear ? { foundingDate: registry.foundedYear } : {}),
    ...(registry.dissolvedYear ? { dissolutionDate: registry.dissolvedYear } : {}),
    ...(registry.nationality ? { nationality: registry.nationality } : {}),
  });

  const itemsLd =
    artistLots.length > 0
      ? itemListJsonLd(artistLots.map((l) => ({ name: l.title, url: `${base}${lotPath(l)}` })))
      : null;
  const jsonLdText = jsonLdScript(
    ...(itemsLd ? [crumbs, subjectLd, itemsLd] : [crumbs, subjectLd]),
  );

  const kindSegment: string | null = registry.kind ? kindDirectorySlug(registry.kind) : null;
  const relatedRows = await loadRelatedDirectoryArtists(id, registry);
  const browseHref = kindSegment ? `/artists/kind/${kindSegment}` : "/artists";

  // Build directory pivot chips so visitors can jump from a single artist to
  // their decade / nationality / kind slice. Each chip is a real `<a>` so SEO
  // and JS-disabled visitors both work, and it strengthens internal linking.
  const birthMatch = registry.birthYear?.match(/^\d{4}/);
  const birthYearNum = birthMatch?.[0] != null ? Number.parseInt(birthMatch[0], 10) : null;
  const decadeSlug = (() => {
    if (birthYearNum == null) return null;
    if (birthYearNum < 1800) return "pre-1800";
    const start = Math.floor(birthYearNum / 10) * 10;
    return normalizeDecadeSegment(`${start}s`);
  })();
  const pivotChips: Array<{ href: string; label: string; aria: string }> = [];
  if (decadeSlug) {
    pivotChips.push({
      href: `/artists/decade/${decadeSlug}`,
      label: decadeSlug === "pre-1800" ? "Born before 1800" : `Born in the ${decadeSlug}`,
      aria: `Browse artists born in the ${decadeSlug === "pre-1800" ? "pre-1800 era" : decadeSlug}`,
    });
  }
  if (registry.nationality?.trim()) {
    const nat = registry.nationality.trim();
    const natSlug = slugifyNationality(nat);
    pivotChips.push({
      href: `/artists/nationality/${natSlug}`,
      label: nat,
      aria: `Browse ${nat} artists`,
    });
  }
  if (kindSegment) {
    pivotChips.push({
      href: `/artists/kind/${kindSegment}`,
      label: `More ${kindConfig.pluralLabel.toLowerCase()}`,
      aria: `Browse all ${kindConfig.pluralLabel.toLowerCase()}`,
    });
  }

  // Department chips link to the collecting-category directory slice. Built from
  // the registry-backed categories attached to this profile.
  const categoryChips = (registry.categories ?? []).slice(0, 6);

  // Kind-specific attribute rows (e.g. movement/medium, marque country/founder)
  // surfaced from the JSONB attributes via the config registry (OCP).
  const attributeRows = kindConfig.attributes
    .map((field) => ({
      label: field.label,
      value: registry.attributes?.[field.key]?.trim() ?? "",
    }))
    .filter((entry) => entry.value.length > 0);

  // Compose hero scenario chips + alias chips into the hero `actions` slot's
  // sibling area. We keep `ArtistHero`'s contract (vm + actions) untouched and
  // pass the badges via the actions slot above the buttons.
  const scenarioStrip = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ArtistScenarioBadges
          kind={registry.kind ?? null}
          featured={isFeatured}
          verified={registry.verified ?? false}
          deathYear={registry.deathYear ?? null}
        />
        {aliasesList.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
              Also known as
            </span>
            {aliasesList.map((a) => (
              <Badge key={a} variant="outline" className="text-xs">
                {a}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      {categoryChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
            Departments
          </span>
          {categoryChips.map((c) => (
            <Link
              key={c.id}
              href={`/artists?category=${encodeURIComponent(c.slug)}`}
              aria-label={`Browse ${kindConfig.pluralLabel.toLowerCase()} in ${c.name}`}
              className="rounded-full border border-outline-variant/40 bg-surface-container-low px-3 py-1 font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant transition-colors hover:border-link/40 hover:bg-surface-container-high hover:text-link"
            >
              {c.name}
            </Link>
          ))}
        </div>
      ) : null}
      {pivotChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
            Browse similar
          </span>
          {pivotChips.map((c) => (
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
          {shouldNoIndex(registry) ? <meta name="robots" content="noindex,follow" /> : null}
        </>
      }
      wayfinding={
        <MarketingDetailWayfinding
          backHref={directoryBackHref}
          backLabel="Back to artists"
          breadcrumbItems={[
            { label: "Home", href: "/" },
            { label: "Artists", href: "/artists" },
            { label: artistName, current: true },
          ]}
          className="mb-8"
        />
      }
      stickyChrome={
        <ArtistStickyFollow
          artistId={id}
          artistName={artistName}
          initialWatching={watching}
          isAuthenticated={isAuthed}
          loginNextPath={profilePath}
        />
      }
    >
      <ArtistHero
        vm={{
          id,
          name: artistName,
          tagline: artistTagline,
          bio: artistBio,
          portraitUrl: artistPortraitUrl,
          featured: isFeatured,
        }}
        actions={
          <div className="flex flex-col gap-4">
            {scenarioStrip}
            <div className="flex flex-wrap items-center gap-3">
              <ArtistWatchToggle
                artistId={id}
                initialWatching={watching}
                isAuthenticated={isAuthed}
                loginNextPath={profilePath}
              />
              <ShareButton url={profileUrl} title={artistName} />
              {registry.websiteUrl ? (
                <a
                  href={registry.websiteUrl}
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
      {attributeRows.length > 0 ? (
        <section className="mb-20">
          <h2 className="mb-6 font-label text-[0.65rem] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            {kindConfig.label} details
          </h2>
          <dl className="grid grid-cols-1 gap-y-5 border-y border-outline-variant/40 py-8 sm:grid-cols-2 md:grid-cols-3">
            {attributeRows.map((row) => (
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
        {artistLots.length === 0 ? (
          <ArtistWorksEmptyState />
        ) : (
          <>
            <ViewItemListTracker
              listId={`artist:${id}`}
              listName="Artist works"
              itemIds={artistLots.map((l) => l.id)}
            />
            <ArtistWorksGrid lots={artistLots} currentUserId={currentUserId} />
          </>
        )}
      </section>
      <ArtistRelatedDirectorySection
        rows={relatedRows}
        watchSet={new Set(watchedArtistIds)}
        isAuthenticated={isAuthed}
        browseHref={browseHref}
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
