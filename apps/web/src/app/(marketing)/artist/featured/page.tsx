import { getServerArtistReader } from "@/lib/data/http/artist.server";
import Image from "next/image";
import Link from "next/link";

export default async function FeaturedArtistsPage() {
  const reader = await getServerArtistReader();
  const artists = await reader.listFeatured();

  return (
    <main id="main-content" className="mx-auto max-w-[1920px] px-6 pb-24 pt-28 md:px-16 lg:px-20">
      <nav
        aria-label="Breadcrumb"
        className="mb-10 font-label text-[10px] uppercase tracking-[0.2em] text-secondary"
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
            Artists
          </li>
        </ol>
      </nav>

      <header className="mb-16 max-w-3xl">
        <p className="mb-3 font-label text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
          Featured roster
        </p>
        <h1 className="mb-6 font-headline text-4xl tracking-tight text-on-surface md:text-6xl">
          Artists &amp; makers
        </h1>
        <p className="font-body text-sm leading-relaxed text-on-surface-variant md:text-base">
          Discover the voices behind the lots on the block. Each profile opens a dedicated view with
          biography and curated context.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {artists.map((a) => (
          <li key={a.id}>
            <Link
              href={`/artist/${a.id}`}
              className="group block overflow-hidden rounded-lg bg-surface-container-low shadow-sm ring-1 ring-outline-variant/10 transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[4/5] bg-surface-container-low">
                <Image
                  src={a.portraitUrl}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
              </div>
              <div className="p-6">
                <h2 className="font-headline text-2xl font-light text-on-surface group-hover:italic">
                  {a.name}
                </h2>
                <p className="mt-2 line-clamp-2 font-body text-sm text-on-surface-variant">
                  {a.tagline}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 font-label text-[10px] font-bold uppercase tracking-widest text-primary">
                  View portfolio
                  <span className="material-symbols-outlined text-sm" aria-hidden>
                    arrow_forward
                  </span>
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
