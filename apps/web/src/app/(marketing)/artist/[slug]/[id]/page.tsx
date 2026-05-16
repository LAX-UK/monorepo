import { ArtistScenarioBadges } from "@/components/artists/artist-scenario-badge";
import { ArtistWatchToggle } from "@/components/marketing/artist-watch-toggle";
import { MarketingBreadcrumb } from "@/components/marketing/marketing-breadcrumb";
import { ShareButton } from "@/components/marketing/share-button";
import { ArtistHero } from "@/components/sections/artists/artist-hero";
import { ArtistStickyFollow } from "@/components/sections/artists/artist-sticky-follow";
import { ArtistWorksGrid } from "@/components/sections/artists/artist-works-grid";
import { normalizeDecadeSegment, slugifyNationality } from "@/lib/artists/directory-presets";
import { getServerMyArtistWatchIds } from "@/lib/data/http/artist-watchlist.server";
import {
  fetchPublicArtistAliases,
  fetchRegistryArtistById,
  getServerArtistById,
  getServerArtistReader,
} from "@/lib/data/http/artist.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerPublicUserReader } from "@/lib/data/http/users-public.server";
import { metadataForNotFound, metadataForSeller } from "@/lib/seo/metadata-factory";
import {
  brandOrOrganizationJsonLd,
  breadcrumbJsonLd,
  itemListJsonLd,
  jsonLdScript,
  personJsonLd,
  visualArtistJsonLd,
} from "@/lib/seo/structured-data";
import { artistPath, lotPath, slugify } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { Lot, ArtistProfile as RegistryArtist } from "@auction/types";
import { Badge } from "@auction/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string; id: string }>;
};

async function loadSellerLots(sellerId: string): Promise<Lot[]> {
  const auctionReader = await getServerLotReader();
  try {
    const [active, scheduled, ended] = await Promise.all([
      auctionReader.list({
        sellerId,
        status: "active",
        limit: 24,
        offset: 0,
        sort: "endingAsc",
      }),
      auctionReader.list({
        sellerId,
        status: "scheduled",
        limit: 24,
        offset: 0,
        sort: "endingAsc",
      }),
      auctionReader.list({
        sellerId,
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

function ensureCanonicalArtistSlug(slug: string, artist: { id: string; name: string }) {
  if (slug !== slugify(artist.name)) permanentRedirect(artistPath(artist));
}

/** `noindex` for any registry artist that shouldn't be ranked: merged, archived, rejected. */
function shouldNoIndex(registry: RegistryArtist | null): boolean {
  if (!registry) return false;
  if (registry.archived) return true;
  if (registry.status === "merged_into" || registry.status === "rejected") return true;
  return false;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, slug } = await params;
  const [artist, registry] = await Promise.all([
    getServerArtistById(id),
    fetchRegistryArtistById(id),
  ]);
  if (artist) {
    ensureCanonicalArtistSlug(slug, artist);
    const base = metadataForSeller(artist);
    if (shouldNoIndex(registry)) {
      return { ...base, robots: { index: false, follow: true } };
    }
    return base;
  }
  const publicReader = await getServerPublicUserReader();
  const user = await publicReader.getById(id).catch(() => null);
  if (!user) return metadataForNotFound("Artist not found");
  ensureCanonicalArtistSlug(slug, user);
  return metadataForSeller(user);
}

export default async function ArtistPage({ params }: PageProps) {
  const { id, slug } = await params;
  const reader = await getServerArtistReader();
  const [sellerLots, artist, registry, aliases, session, featured, watchedArtistIds] =
    await Promise.all([
      loadSellerLots(id),
      getServerArtistById(id),
      fetchRegistryArtistById(id),
      fetchPublicArtistAliases(id),
      getServerSessionUser(),
      reader.listFeatured(),
      getServerMyArtistWatchIds(),
    ]);
  const currentUserId = session?.id ?? null;
  const base = getSiteUrl();
  const isFeatured = featured.some((a) => a.id === id);
  const watching = watchedArtistIds.includes(id);
  const isAuthed = Boolean(session);

  if (!artist) {
    const publicReader = await getServerPublicUserReader();
    const user = await publicReader.getById(id).catch(() => null);
    if (!user) notFound();
    ensureCanonicalArtistSlug(slug, user);
    const profilePath = artistPath(user);
    const profileUrl = `${base}${profilePath}`;

    const crumbs = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: user.name, path: profilePath },
    ]);
    const personLd = personJsonLd({
      name: user.name,
      url: profileUrl,
      description: "Seller on LAX.BID by London Art Exchange.",
    });
    const itemsLd =
      sellerLots.length > 0
        ? itemListJsonLd(sellerLots.map((l) => ({ name: l.title, url: `${base}${lotPath(l)}` })))
        : null;
    const jsonLdText = jsonLdScript(
      ...(itemsLd ? [crumbs, personLd, itemsLd] : [crumbs, personLd]),
    );

    return (
      <main
        id="main-content"
        className="mx-auto max-w-[var(--container-max,1440px)] px-5 pb-20 pt-[var(--section-pt)] md:px-10 xl:px-20"
      >
        <script type="application/ld+json" suppressHydrationWarning>
          {jsonLdText}
        </script>
        <MarketingBreadcrumb
          className="mb-8 font-label text-xs uppercase tracking-[0.2em] text-secondary"
          items={[
            { label: "Home", href: "/" },
            { label: user.name, current: true },
          ]}
        />
        <ArtistHero
          vm={{
            id,
            name: user.name,
            tagline:
              "Seller on LAX.BID by London Art Exchange \u2014 lots listed below are attributed to this account.",
            bio: null,
            portraitUrl: null,
            featured: false,
          }}
          actions={
            <>
              <ArtistWatchToggle
                artistId={id}
                initialWatching={watching}
                isAuthenticated={isAuthed}
                loginNextPath={profilePath}
              />
              <ShareButton url={profileUrl} title={user.name} />
            </>
          }
        />
        <section id="works">
          {sellerLots.length === 0 ? (
            <p className="font-body text-on-surface-variant">No public lots for this seller yet.</p>
          ) : (
            <ArtistWorksGrid lots={sellerLots} currentUserId={currentUserId} />
          )}
        </section>
        <ArtistStickyFollow
          artistId={id}
          artistName={user.name}
          initialWatching={watching}
          isAuthenticated={isAuthed}
          loginNextPath={profilePath}
        />
      </main>
    );
  }

  ensureCanonicalArtistSlug(slug, artist);
  const profilePath = artistPath(artist);
  const profileUrl = `${base}${profilePath}`;

  const isBrand = registry?.kind === "brand" || registry?.kind === "marque";
  const aliasesList = aliases.slice(0, 6);

  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Artists", path: "/artists" },
    { name: artist.name, path: profilePath },
  ]);

  const description: string | undefined =
    (artist.tagline ?? artist.bio) ? ((artist.tagline ?? artist.bio) as string) : undefined;
  const sameAs = registry?.websiteUrl ? [registry.websiteUrl] : undefined;

  const subjectLd = isBrand
    ? brandOrOrganizationJsonLd({
        type: registry?.kind === "marque" ? "Organization" : "Brand",
        name: artist.name,
        url: profileUrl,
        ...(artist.portraitUrl ? { image: artist.portraitUrl } : {}),
        ...(description ? { description } : {}),
        ...(sameAs ? { sameAs } : {}),
        ...(aliasesList.length > 0 ? { alternateName: aliasesList } : {}),
      })
    : visualArtistJsonLd({
        name: artist.name,
        url: profileUrl,
        ...(artist.portraitUrl ? { image: artist.portraitUrl } : {}),
        ...(description ? { description } : {}),
        ...(sameAs ? { sameAs } : {}),
        ...(registry?.birthYear ? { birthDate: registry.birthYear } : {}),
        ...(registry?.deathYear ? { deathDate: registry.deathYear } : {}),
        ...(registry?.nationality ? { nationality: registry.nationality } : {}),
        ...(aliasesList.length > 0 ? { alternateName: aliasesList } : {}),
      });

  const itemsLd =
    sellerLots.length > 0
      ? itemListJsonLd(sellerLots.map((l) => ({ name: l.title, url: `${base}${lotPath(l)}` })))
      : null;
  const jsonLdText = jsonLdScript(
    ...(itemsLd ? [crumbs, subjectLd, itemsLd] : [crumbs, subjectLd]),
  );

  const related = featured.filter((a) => a.id !== id).slice(0, 8);

  // Build directory pivot chips so visitors can jump from a single artist to
  // their decade / nationality / kind slice. Each chip is a real `<a>` so SEO
  // and JS-disabled visitors both work, and it strengthens internal linking.
  const birthMatch = registry?.birthYear?.match(/^\d{4}/);
  const birthYearNum = birthMatch?.[0] != null ? Number.parseInt(birthMatch[0], 10) : null;
  const decadeSlug = (() => {
    if (birthYearNum == null) return null;
    if (birthYearNum < 1800) return "pre-1800";
    const start = Math.floor(birthYearNum / 10) * 10;
    return normalizeDecadeSegment(`${start}s`);
  })();
  const kindSegment: string | null = (() => {
    switch (registry?.kind) {
      case "artist":
        return "artists";
      case "maker":
        return "makers";
      case "brand":
        return "brands";
      case "marque":
        return "marques";
      default:
        return null;
    }
  })();
  const pivotChips: Array<{ href: string; label: string; aria: string }> = [];
  if (decadeSlug) {
    pivotChips.push({
      href: `/artists/decade/${decadeSlug}`,
      label: decadeSlug === "pre-1800" ? "Born before 1800" : `Born in the ${decadeSlug}`,
      aria: `Browse artists born in the ${decadeSlug === "pre-1800" ? "pre-1800 era" : decadeSlug}`,
    });
  }
  if (registry?.nationality?.trim()) {
    const nat = registry.nationality.trim();
    const natSlug = slugifyNationality(nat);
    pivotChips.push({
      href: `/artists/nationality/${natSlug}`,
      label: nat,
      aria: `Browse ${nat} artists`,
    });
  }
  if (kindSegment) {
    const kindLabel =
      kindSegment === "artists"
        ? "More artists"
        : kindSegment === "makers"
          ? "More makers"
          : kindSegment === "brands"
            ? "More brands"
            : "More marques";
    pivotChips.push({
      href: `/artists/kind/${kindSegment}`,
      label: kindLabel,
      aria: `Browse all ${kindSegment}`,
    });
  }

  // Compose hero scenario chips + alias chips into the hero `actions` slot's
  // sibling area. We keep `ArtistHero`'s contract (vm + actions) untouched and
  // pass the badges via the actions slot above the buttons.
  const scenarioStrip = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ArtistScenarioBadges
          kind={registry?.kind ?? null}
          featured={isFeatured}
          verified={registry?.verified ?? false}
          deathYear={registry?.deathYear ?? null}
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
              className="rounded-full border border-outline-variant/40 bg-surface-container-low px-3 py-1 font-label text-[10px] uppercase tracking-widest text-on-surface-variant transition-colors hover:border-primary/40 hover:bg-surface-container-high hover:text-primary"
            >
              {c.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <main
      id="main-content"
      className="mx-auto max-w-[var(--container-max,1440px)] px-5 pb-20 pt-[var(--section-pt)] md:px-10 xl:px-20"
    >
      <script type="application/ld+json" suppressHydrationWarning>
        {jsonLdText}
      </script>
      {shouldNoIndex(registry) ? <meta name="robots" content="noindex,follow" /> : null}

      <MarketingBreadcrumb
        className="mb-8 font-label text-xs uppercase tracking-[0.2em] text-secondary"
        items={[
          { label: "Home", href: "/" },
          { label: "Artists", href: "/artists" },
          { label: artist.name, current: true },
        ]}
      />
      <ArtistHero
        vm={{
          id,
          name: artist.name,
          tagline: artist.tagline ?? null,
          bio: artist.bio ?? null,
          portraitUrl: artist.portraitUrl ?? null,
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
              <ShareButton url={profileUrl} title={artist.name} />
              {registry?.websiteUrl ? (
                <a
                  href={registry.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
                >
                  Official website
                </a>
              ) : null}
            </div>
          </div>
        }
      />
      {artist.stats.length > 0 ? (
        <section className="mb-20 grid grid-cols-2 gap-y-5 border-y border-outline-variant/40 py-8 md:grid-cols-4 md:gap-0">
          {artist.stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col gap-2 px-0 md:border-r md:border-outline-variant/40 md:px-5 md:first:pl-0 md:last:border-r-0"
            >
              <span className="mb-2 font-label text-[0.65rem] uppercase tracking-widest text-secondary">
                {s.label}
              </span>
              <span className="font-headline text-3xl text-on-surface">{s.value}</span>
            </div>
          ))}
        </section>
      ) : null}
      <section id="works">
        {sellerLots.length === 0 ? (
          <p className="rounded-xl border border-outline-variant/15 bg-surface-container-low/50 p-10 text-center font-body text-on-surface-variant ring-1 ring-outline-variant/10">
            No public lots for this profile yet. Browse{" "}
            <Link href="/" className="text-primary underline-offset-4 hover:underline">
              live salerooms
            </Link>
            .
          </p>
        ) : (
          <ArtistWorksGrid lots={sellerLots} currentUserId={currentUserId} />
        )}
      </section>
      {related.length > 0 ? (
        <section
          className="mt-16 border-t border-outline-variant/20 pt-12"
          aria-labelledby="related-artists"
        >
          <h2 id="related-artists" className="mb-6 font-headline text-2xl text-on-surface">
            More in the directory
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((a) => (
              <li key={a.id}>
                <Link
                  href={artistPath(a)}
                  className="block rounded-lg border border-outline-variant/20 bg-surface-container-low/40 p-4 transition hover:border-primary/40 hover:bg-surface-container-low"
                >
                  <p className="font-headline text-base text-on-surface">{a.name}</p>
                  {a.tagline ? (
                    <p className="mt-1 line-clamp-2 font-body text-sm text-on-surface-variant">
                      {a.tagline}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ArtistStickyFollow
        artistId={id}
        artistName={artist.name}
        initialWatching={watching}
        isAuthenticated={isAuthed}
        loginNextPath={profilePath}
      />
    </main>
  );
}
