import { getServerArtistReader } from "@/lib/data/http/artist.server";
import { getServerAuctionReader } from "@/lib/data/http/auctions.server";
import { getServerPublicUserReader } from "@/lib/data/http/users-public.server";
import { metadataForSeller } from "@/lib/seo/metadata-factory";
import type { Auction } from "@auction/types";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const reader = await getServerArtistReader();
  const artist = await reader.getById(id);
  if (artist) return { title: artist.name };
  const publicReader = await getServerPublicUserReader();
  const user = await publicReader.getById(id).catch(() => null);
  if (!user) return { title: "Artist" };
  return metadataForSeller(user.name, id);
}

export default async function ArtistPage({ params }: PageProps) {
  const { id } = await params;
  const reader = await getServerArtistReader();
  const artist = await reader.getById(id);
  if (!artist) {
    const publicReader = await getServerPublicUserReader();
    const user = await publicReader.getById(id).catch(() => null);
    if (!user) notFound();
    const auctionReader = await getServerAuctionReader();
    const [active, ended] = await Promise.all([
      auctionReader
        .list({ sellerId: id, status: "active", limit: 24, offset: 0, sort: "endingAsc" })
        .catch(() => [] as Auction[]),
      auctionReader
        .list({ sellerId: id, status: "ended", limit: 24, offset: 0, sort: "endedDesc" })
        .catch(() => [] as Auction[]),
    ]);
    const sellerLots = [...active, ...ended];
    return (
      <main id="main-content" className="mx-auto max-w-[1920px] px-10 pb-20 pt-32 md:px-20">
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
          Seller on The Digital Curator — lots listed below are attributed to this account.
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
    <main id="main-content" className="mx-auto max-w-[1920px] px-10 pb-20 pt-32 md:px-20">
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
            <Image
              src={artist.portraitUrl}
              alt={artist.name}
              width={560}
              height={700}
              className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
            />
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
          <p className="mb-8 max-w-xl font-headline text-xl italic leading-relaxed text-secondary md:text-2xl">
            &ldquo;{artist.tagline}&rdquo;
          </p>
          <p className="max-w-xl font-body text-sm leading-loose tracking-wide text-on-surface-variant opacity-80">
            {artist.bio}
          </p>
        </div>
      </section>
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
      <div className="mb-12 flex items-center justify-between">
        <h2 className="font-headline text-3xl tracking-tight">Curated Works</h2>
        <div className="flex gap-4">
          <span className="flex items-center rounded-full bg-secondary-container px-4 py-1 font-label text-[0.7rem] uppercase tracking-widest text-on-secondary-container">
            Available
          </span>
          <span className="flex items-center rounded-full bg-surface-container-high px-4 py-1 font-label text-[0.7rem] uppercase tracking-widest text-secondary">
            Archive
          </span>
        </div>
      </div>
      <output
        className="block rounded-xl bg-surface-container-low/80 p-10 text-center shadow-sm ring-1 ring-outline-variant/10 md:p-16"
        aria-live="polite"
      >
        <p className="mx-auto mb-6 max-w-lg font-headline text-xl font-light text-on-surface md:text-2xl">
          Works linked to this artist will appear here.
        </p>
        <p className="mx-auto mb-8 max-w-md font-body text-sm text-on-surface-variant">
          Seller profiles and lot attribution are coming soon. Until then, explore live and past
          auctions in the gallery.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center bg-gradient-to-br from-primary to-primary-container px-8 py-3 font-label text-xs font-bold uppercase tracking-[0.3em] text-on-primary shadow-sm transition-opacity hover:opacity-95"
        >
          Browse auctions
        </Link>
      </output>
    </main>
  );
}
