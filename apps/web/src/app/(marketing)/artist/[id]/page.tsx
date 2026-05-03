import { ArtistWatchToggle } from "@/components/marketing/artist-watch-toggle";
import { ShareButton } from "@/components/marketing/share-button";
import { ArtistBioReadMore } from "@/components/sections/artists/artist-bio-read-more";
import { getServerMyArtistWatchIds } from "@/lib/data/http/artist-watchlist.server";
import { getServerArtistReader } from "@/lib/data/http/artist.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerPublicUserReader } from "@/lib/data/http/users-public.server";
import { metadataForSeller } from "@/lib/seo/metadata-factory";
import {
  breadcrumbJsonLd,
  itemListJsonLd,
  jsonLdScript,
  personJsonLd,
} from "@/lib/seo/structured-data";
import { getSiteUrl } from "@/lib/site-url";
import type { Lot } from "@auction/types";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtistWorksGrid } from "../../../../components/sections/artists/artist-works-grid";

type PageProps = {
  params: Promise<{ id: string }>;
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const reader = await getServerArtistReader();
  const artist = await reader.getById(id);
  if (artist) return metadataForSeller(artist.name, id);
  const publicReader = await getServerPublicUserReader();
  const user = await publicReader.getById(id).catch(() => null);
  if (!user) return { title: "Artist" };
  return metadataForSeller(user.name, id);
}

export default async function ArtistPage({ params }: PageProps) {
  const { id } = await params;
  const reader = await getServerArtistReader();
  const [sellerLots, artist, session, featured, watchedArtistIds] = await Promise.all([
    loadSellerLots(id),
    reader.getById(id),
    getServerSessionUser(),
    reader.listFeatured(),
    getServerMyArtistWatchIds(),
  ]);
  const currentUserId = session?.id ?? null;
  const base = getSiteUrl();
  const profileUrl = `${base}/artist/${id}`;
  const isFeatured = featured.some((a) => a.id === id);
  const watching = watchedArtistIds.includes(id);
  const isAuthed = Boolean(session);

  if (!artist) {
    const publicReader = await getServerPublicUserReader();
    const user = await publicReader.getById(id).catch(() => null);
    if (!user) notFound();

    const crumbs = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: user.name, path: `/artist/${id}` },
    ]);
    const personLd = personJsonLd({
      name: user.name,
      url: profileUrl,
      description: "Seller on LAX London Auction House Ltd.",
    });
    const itemsLd =
      sellerLots.length > 0
        ? itemListJsonLd(sellerLots.map((l) => ({ name: l.title, url: `${base}/artwork/${l.id}` })))
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
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <ArtistWatchToggle artistId={id} initialWatching={watching} isAuthenticated={isAuthed} />
          <ShareButton url={profileUrl} title={user.name} />
        </div>
        <h1 className="mb-4 font-headline text-5xl tracking-tight text-on-surface md:text-7xl">
          {user.name}
        </h1>
        <p className="mb-12 max-w-2xl font-body text-sm text-on-surface-variant">
          Seller on LAX London Auction House Ltd — lots listed below are attributed to this account.
        </p>
        {sellerLots.length === 0 ? (
          <p className="font-body text-on-surface-variant">No public lots for this seller yet.</p>
        ) : (
          <ArtistWorksGrid lots={sellerLots} currentUserId={currentUserId} />
        )}
      </main>
    );
  }

  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Artists", path: "/artist/featured" },
    { name: artist.name, path: `/artist/${id}` },
  ]);
  const personLd = personJsonLd({
    name: artist.name,
    url: profileUrl,
    ...(artist.portraitUrl ? { image: artist.portraitUrl } : {}),
    ...((artist.tagline ?? artist.bio)
      ? { description: (artist.tagline ?? artist.bio) as string }
      : {}),
  });
  const itemsLd =
    sellerLots.length > 0
      ? itemListJsonLd(sellerLots.map((l) => ({ name: l.title, url: `${base}/artwork/${l.id}` })))
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
      <section className="mb-16 grid grid-cols-1 items-end gap-0 md:mb-20 md:min-h-[calc(100vh_-_var(--header-height))] md:grid-cols-[5fr_7fr]">
        <div className="relative md:sticky md:top-[var(--header-height)] md:h-[calc(100vh_-_var(--header-height))]">
          <div className="h-[65vw] min-h-[220px] max-h-[480px] w-full overflow-hidden bg-surface-container-low md:h-full md:max-h-none">
            {artist.portraitUrl ? (
              <Image
                src={artist.portraitUrl}
                alt={artist.name}
                width={560}
                height={700}
                className="h-full w-full object-cover transition-transform duration-700 motion-safe:hover:scale-105 motion-reduce:hover:scale-100"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center bg-surface-container-high font-headline text-4xl text-on-surface-variant"
                aria-hidden
              >
                {artist.name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-start gap-8 px-0 py-8 md:px-10 md:py-16 lg:px-14 lg:py-20">
          {isFeatured ? (
            <span className="font-label text-xs uppercase tracking-[0.3em] text-primary">
              Featured artist
            </span>
          ) : null}
          <h1 className="font-headline text-[clamp(3rem,6vw,6rem)] font-semibold leading-[0.95] tracking-tighter text-on-surface">
            {artist.name.split(" ").map((w, i) => (
              <span key={`${i}-${w}`} className="block">
                {w}
              </span>
            ))}
          </h1>
          {artist.tagline ? (
            <p className="max-w-[420px] font-headline text-lg font-light italic leading-relaxed text-secondary">
              &ldquo;{artist.tagline}&rdquo;
            </p>
          ) : null}
          {artist.bio ? <ArtistBioReadMore bio={artist.bio} /> : null}
          <div className="flex flex-wrap items-center gap-3">
            <ArtistWatchToggle
              artistId={id}
              initialWatching={watching}
              isAuthenticated={isAuthed}
            />
            <ShareButton url={profileUrl} title={artist.name} />
          </div>
        </div>
      </section>
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
