import type { ArtistProfile } from "@/lib/data/contracts";
import Image from "next/image";
import Link from "next/link";

type Props = {
  artist: ArtistProfile;
};

function splitDisplayName(fullName: string): { first: string; rest: string | null } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) {
    return { first: fullName.trim(), rest: null };
  }
  return { first: parts[0] ?? fullName, rest: parts.slice(1).join(" ") };
}

export function ArtistSpotlightHero({ artist }: Props) {
  const { first, rest } = splitDisplayName(artist.name);
  const href = `/artist/${artist.id}`;

  return (
    <section className="relative flex min-h-[min(870px,92vh)] w-full items-center overflow-hidden bg-surface">
      <div className="absolute inset-0 left-auto h-full w-full md:right-0 md:w-3/5">
        <Image
          src={artist.portraitUrl}
          alt=""
          fill
          className="object-cover grayscale transition-all duration-1000 hover:grayscale-0"
          sizes="(max-width: 768px) 100vw, 60vw"
          priority
        />
        <div
          className="absolute inset-0 hidden bg-gradient-to-r from-surface via-surface/40 to-transparent md:block"
          aria-hidden
        />
      </div>
      <div className="relative z-10 w-full px-8 md:w-1/2 md:px-20">
        <span className="mb-6 block font-label text-xs uppercase tracking-[0.4em] text-primary">
          Featured Artist of the Month
        </span>
        <h1 className="mb-8 font-headline text-6xl leading-tight tracking-tighter text-on-surface md:text-8xl lg:text-9xl">
          {first}
          {rest ? (
            <>
              <br />
              <span className="ml-8 font-light italic md:ml-20">{rest}</span>
            </>
          ) : null}
        </h1>
        <p className="mb-10 max-w-md font-body text-lg leading-relaxed text-secondary">
          {artist.tagline}
        </p>
        <div className="flex flex-wrap items-center gap-8">
          <Link
            href={href}
            className="bg-gradient-to-r from-primary to-primary-container px-10 py-4 font-label text-xs font-bold uppercase tracking-widest text-on-primary shadow-xl transition-all hover:shadow-primary/20"
          >
            View collection
          </Link>
          <Link
            href={href}
            className="border-b border-outline-variant pb-1 font-label text-xs font-bold uppercase tracking-widest text-on-surface transition-colors hover:text-primary"
          >
            Biography
          </Link>
        </div>
      </div>
    </section>
  );
}
