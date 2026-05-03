import { ArtistWatchToggle } from "@/components/marketing/artist-watch-toggle";
import { ShareButton } from "@/components/marketing/share-button";
import { ArtistHero } from "@/components/sections/artists/artist-hero";
import { getServerMyArtistWatchIds } from "@/lib/data/http/artist-watchlist.server";
import { getServerArtistById, getServerArtistReader } from "@/lib/data/http/artist.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerPublicUserReader } from "@/lib/data/http/users-public.server";
import { metadataForNotFound, metadataForSeller } from "@/lib/seo/metadata-factory";
import {
  breadcrumbJsonLd,
  itemListJsonLd,
  jsonLdScript,
  personJsonLd,
  visualArtistJsonLd,
} from "@/lib/seo/structured-data";
import { artistPath, lotPath, slugify } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { Lot } from "@auction/types";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArtistWorksGrid } from "../../../../../components/sections/artists/artist-works-grid";

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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, slug } = await params;
  const artist = await getServerArtistById(id);
  if (artist) {
    ensureCanonicalArtistSlug(slug, artist);
    return metadataForSeller(artist);
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
  const [sellerLots, artist, session, featured, watchedArtistIds] = await Promise.all([
    loadSellerLots(id),
    getServerArtistById(id),
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
      description: "Seller on LAX London Auction House Ltd.",
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
        className="mx-auto max-w-[1920px] px-5 pb-20 pt-[var(--section-pt)] md:px-10 xl:px-20"
      >
        <script type="application/ld+json" suppressHydrationWarning>
          {jsonLdText}
        </script>
        <nav
          aria-label="Breadcrumb"
          className="mb-8 font-label text-xs uppercase tracking-[0.2em] text-secondary"
        >
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="transition-colors hover:text-primary">
                Gallery
              </Link>
            </li>
            <li aria-hidden className="text-outline-variant">
              /
            </li>
            <li className="text-on-surface" aria-current="page">
              {user.name}
            </li>
          </ol>
        </nav>
        <ArtistHero
          vm={{
            id,
            name: user.name,
            tagline:
              "Seller on LAX London Auction House Ltd \u2014 lots listed below are attributed to this account.",
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
        {sellerLots.length === 0 ? (
          <p className="font-body text-on-surface-variant">No public lots for this seller yet.</p>
        ) : (
          <ArtistWorksGrid lots={sellerLots} currentUserId={currentUserId} />
        )}
      </main>
    );
  }

  ensureCanonicalArtistSlug(slug, artist);
  const profilePath = artistPath(artist);
  const profileUrl = `${base}${profilePath}`;
  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Artists", path: "/artist/featured" },
    { name: artist.name, path: profilePath },
  ]);
  const personLd = visualArtistJsonLd({
    name: artist.name,
    url: profileUrl,
    ...(artist.portraitUrl ? { image: artist.portraitUrl } : {}),
    ...((artist.tagline ?? artist.bio)
      ? { description: (artist.tagline ?? artist.bio) as string }
      : {}),
  });
  const itemsLd =
    sellerLots.length > 0
      ? itemListJsonLd(sellerLots.map((l) => ({ name: l.title, url: `${base}${lotPath(l)}` })))
      : null;
  const jsonLdText = jsonLdScript(...(itemsLd ? [crumbs, personLd, itemsLd] : [crumbs, personLd]));

  return (
    <main
      id="main-content"
      className="mx-auto max-w-[1920px] px-5 pb-20 pt-[var(--section-pt)] md:px-10 xl:px-20"
    >
      <script type="application/ld+json" suppressHydrationWarning>
        {jsonLdText}
      </script>
      <nav
        aria-label="Breadcrumb"
        className="mb-8 font-label text-xs uppercase tracking-[0.2em] text-secondary"
      >
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="transition-colors hover:text-primary">
              Gallery
            </Link>
          </li>
          <li aria-hidden className="text-outline-variant">
            /
          </li>
          <li>
            <Link href="/artist/featured" className="transition-colors hover:text-primary">
              Artists
            </Link>
          </li>
          <li aria-hidden className="text-outline-variant">
            /
          </li>
          <li className="text-on-surface" aria-current="page">
            {artist.name}
          </li>
        </ol>
      </nav>
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
          <>
            <ArtistWatchToggle
              artistId={id}
              initialWatching={watching}
              isAuthenticated={isAuthed}
              loginNextPath={profilePath}
            />
            <ShareButton url={profileUrl} title={artist.name} />
          </>
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
    </main>
  );
}
