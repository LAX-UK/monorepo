import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { createMockArtistReader } from "@/lib/data/mock/artist";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ArtistPage({ params }: PageProps) {
  const { id } = await params;
  const reader = createMockArtistReader();
  const artist = await reader.getById(id);
  if (!artist) {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1920px] px-10 pb-20 pt-32 md:px-20">
        <section className="mb-32 grid grid-cols-1 items-end gap-16 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <div className="aspect-[4/5] overflow-hidden bg-surface-container-low">
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
            <span className="mb-4 font-label text-[0.6875rem] uppercase tracking-[0.3em] text-primary">
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
        <section className="mb-32 grid grid-cols-2 gap-8 border-y border-outline-variant/20 py-16 md:grid-cols-4">
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
        <p className="font-body text-on-surface-variant">
          Connect lots to this artist when seller profiles ship.{" "}
          <Link href="/" className="text-primary underline">
            Browse auctions
          </Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
