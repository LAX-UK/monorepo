import { ArtistWatchToggle } from "@/components/marketing/artist-watch-toggle";
import { OwnerBadge } from "@/components/marketing/owner-badge";
import { ShareButton } from "@/components/marketing/share-button";
import { ArtistBioReadMore } from "@/components/sections/artists/artist-bio-read-more";
import { getServerMyArtistWatchIds } from "@/lib/data/http/artist-watchlist.server";
import { getServerArtistReader } from "@/lib/data/http/artist.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerPublicUserReader } from "@/lib/data/http/users-public.server";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
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

type PageProps = {
  params: Promise<{ id: string }>;
};

async function loadSellerLots(sellerId: string): Promise<Lot[]> {
  const auctionReader = await getServerLotReader();
  try {
    const [active, ended] = await Promise.all([
      auctionReader.list({
        sellerId,
        status: "active",
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
    return [...active, ...ended];
  } catch {
    return [];
  }
}

function LotCatalogCard({ lot, currentUserId }: { lot: Lot; currentUserId: string | null }) {
  const img = lot.images[0];
  const est = lotEstimateLine(lot);
  return (
    <li
      key={lot.id}
      className="overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-low/50 ring-1 ring-outline-variant/10"
    >
      <Link
        href={`/artwork/${lot.id}`}
        className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <div className="relative aspect-[4/5] bg-surface-container-low">
          {img ? (
            <Image
              src={img}
              alt={lot.title}
              fill
              className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-container-high text-xs text-on-surface-variant">
              No image
            </div>
          )}
          <OwnerBadge
            owned={Boolean(currentUserId && lot.sellerId === currentUserId)}
            className="absolute right-3 top-3"
          />
        </div>
        <div className="p-4">
          <h3 className="font-headline text-lg text-on-surface group-hover:text-primary">
            {lot.title}
          </h3>
          {est ? (
            <p className="mt-1 font-label text-[0.65rem] uppercase tracking-wider text-primary">
              Est. {est}
            </p>
          ) : null}
          <p className="mt-2 font-label text-xs uppercase tracking-widest text-secondary">
            {lot.status}
          </p>
        </div>
      </Link>
    </li>
  );
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
        className="mx-auto max-w-[1920px] px-10 pb-20 pt-[var(--section-pt)] md:px-20"
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
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sellerLots.map((a) => (
              <LotCatalogCard key={a.id} lot={a} currentUserId={currentUserId} />
            ))}
          </ul>
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
      className="mx-auto max-w-[1920px] px-10 pb-20 pt-[var(--section-pt)] md:px-20"
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
      <section className="mb-32 grid grid-cols-1 items-end gap-16 md:grid-cols-12">
        <div className="relative md:col-span-5">
          <div className="aspect-4/5 overflow-hidden bg-surface-container-low">
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
        <div className="flex flex-col items-start md:col-span-7">
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <ArtistWatchToggle
              artistId={id}
              initialWatching={watching}
              isAuthenticated={isAuthed}
            />
            <ShareButton url={profileUrl} title={artist.name} />
          </div>
          {isFeatured ? (
            <span className="mb-4 font-label text-xs uppercase tracking-[0.3em] text-primary">
              Featured artist
            </span>
          ) : null}
          <h1 className="mb-8 font-headline text-6xl leading-tight tracking-tighter text-on-surface md:text-8xl lg:text-9xl">
            {artist.name.split(" ").map((w, i) => (
              <span key={`${i}-${w}`} className="block">
                {w}
              </span>
            ))}
          </h1>
          {artist.tagline ? (
            <p className="mb-8 max-w-xl font-headline text-xl italic leading-relaxed text-secondary md:text-2xl">
              &ldquo;{artist.tagline}&rdquo;
            </p>
          ) : null}
          {artist.bio ? <ArtistBioReadMore bio={artist.bio} className="mb-4" /> : null}
        </div>
      </section>
      {artist.stats.length > 0 ? (
        <section className="mb-32 grid grid-cols-2 gap-8 rounded-xl py-16 ring-1 ring-outline-variant/10 md:grid-cols-4">
          {artist.stats.map((s) => (
            <div key={s.label} className="flex flex-col">
              <span className="mb-2 font-label text-[0.65rem] uppercase tracking-widest text-secondary">
                {s.label}
              </span>
              <span className="font-headline text-3xl text-on-surface">{s.value}</span>
            </div>
          ))}
        </section>
      ) : null}
      <div className="mb-12 flex items-center justify-between">
        <h2 className="font-headline text-3xl tracking-tight">Curated Works</h2>
      </div>
      {sellerLots.length === 0 ? (
        <p className="rounded-xl border border-outline-variant/15 bg-surface-container-low/50 p-10 text-center font-body text-on-surface-variant ring-1 ring-outline-variant/10">
          No public lots for this profile yet. Browse{" "}
          <Link href="/" className="text-primary underline-offset-4 hover:underline">
            live salerooms
          </Link>
          .
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sellerLots.map((a) => (
            <LotCatalogCard key={a.id} lot={a} currentUserId={currentUserId} />
          ))}
        </ul>
      )}
    </main>
  );
}
