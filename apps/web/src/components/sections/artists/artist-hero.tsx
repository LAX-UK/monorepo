import { ArtistBioReadMore } from "@/components/sections/artists/artist-bio-read-more";
import Image from "next/image";
import type { ReactNode } from "react";

export type ArtistHeroVM = {
  id: string;
  name: string;
  /** Short italic strapline shown under the name (mock parity). */
  tagline?: string | null;
  bio?: string | null;
  portraitUrl?: string | null;
  featured?: boolean;
};

type Props = {
  vm: ArtistHeroVM;
  /** Watch / share / contact controls slot. Rendered below the bio. */
  actions?: ReactNode;
};

/**
 * Single-responsibility hero composing the portrait, name, tagline, bio and an
 * actions slot. Used by both registered artist profiles and the seller
 * fallback path so the chrome stays Liskov-substitutable across both routes.
 */
export function ArtistHero({ vm, actions }: Props) {
  return (
    <section className="mb-16 grid grid-cols-1 items-end gap-0 md:mb-20 md:min-h-[calc(100vh_-_var(--header-height))] md:grid-cols-[5fr_7fr]">
      <div className="relative md:sticky md:top-[var(--header-height)] md:h-[calc(100vh_-_var(--header-height))]">
        <div className="h-[65vw] min-h-[220px] max-h-[480px] w-full overflow-hidden bg-surface-container-low md:h-full md:max-h-none">
          {vm.portraitUrl ? (
            <Image
              src={vm.portraitUrl}
              alt={vm.name}
              width={560}
              height={700}
              className="h-full w-full object-cover transition-transform duration-700 motion-safe:hover:scale-105 motion-reduce:hover:scale-100"
              priority
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center bg-surface-container-high font-headline text-4xl text-on-surface-variant"
              aria-hidden
            >
              {vm.name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col items-start gap-8 px-0 py-8 md:px-10 md:py-16 lg:px-14 lg:py-20">
        {vm.featured ? (
          <span className="font-label text-xs uppercase tracking-[0.3em] text-primary">
            Featured artist
          </span>
        ) : null}
        <h1 className="font-headline text-[clamp(3rem,6vw,6rem)] font-semibold leading-[0.95] tracking-tighter text-on-surface">
          {vm.name.split(" ").map((w, i) => (
            <span key={`${i}-${w}`} className="block">
              {w}
            </span>
          ))}
        </h1>
        {vm.tagline ? (
          <p className="max-w-[420px] font-headline text-lg font-light italic leading-relaxed text-on-surface-variant">
            &ldquo;{vm.tagline}&rdquo;
          </p>
        ) : null}
        {vm.bio ? <ArtistBioReadMore bio={vm.bio} /> : null}
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}
