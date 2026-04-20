import { getServerArtistReader } from "@/lib/data/http/artist.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerPublicUserReader } from "@/lib/data/http/users-public.server";
import { metadataForSeller } from "@/lib/seo/metadata-factory";
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
  const sellerLots = await loadSellerLots(id);
  const reader = await getServerArtistReader();
  const artist = await reader.getById(id);

  if (!artist) {
    const publicReader = await getServerPublicUserReader();
    const user = await publicReader.getById(id).catch(() => null);
    if (!user) notFound();
    return (
      <main
        id="main-content"
        className="mx-auto max-w-[1920px] px-10 pb-20 pt-[var(--section-pt)] md:px-20"
      >
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
              <li
                key={a.id}
                className="rounded-xl border border-outline-variant/15 bg-surface-container-low/50 p-4 ring-1 ring-outline-variant/10"
              >
                <Link
                  href={`/artwork/${a.id}`}
                  className="font-headline text-lg text-on-surface hover:text-primary"
                >
                  {a.title}
                </Link>
                <p className="mt-2 font-label text-xs uppercase tracking-widest text-secondary">
                  {a.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    );
  }

  return (
    <main
      id="main-content"
      className="mx-auto max-w-[1920px] px-10 pb-20 pt-[var(--section-pt)] md:px-20"
    >
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
                className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
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
          <span className="mb-4 font-label text-xs uppercase tracking-[0.3em] text-primary">
            Featured Artist
          </span>
          <h1 className="mb-8 font-headline text-6xl leading-tight tracking-tighter text-on-surface md:text-8xl lg:text-9xl">
            {artist.name.split(" ").map((w) => (
              <span key={w} className="block">
                {w}
              </span>
            ))}
          </h1>
          {artist.tagline ? (
            <p className="mb-8 max-w-xl font-headline text-xl italic leading-relaxed text-secondary md:text-2xl">
              &ldquo;{artist.tagline}&rdquo;
            </p>
          ) : null}
          {artist.bio ? (
            <p className="max-w-xl font-body text-sm leading-loose tracking-wide text-on-surface-variant opacity-80">
              {artist.bio}
            </p>
          ) : null}
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
            <li
              key={a.id}
              className="rounded-xl border border-outline-variant/15 bg-surface-container-low/50 p-4 ring-1 ring-outline-variant/10"
            >
              <Link
                href={`/artwork/${a.id}`}
                className="font-headline text-lg text-on-surface hover:text-primary"
              >
                {a.title}
              </Link>
              <p className="mt-2 font-label text-xs uppercase tracking-widest text-secondary">
                {a.status}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
