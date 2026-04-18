import type { ArtistCardVM } from "@/components/sections/home/home-view-models";
import Image from "next/image";
import Link from "next/link";

const ARTIST_BLURB =
  "Bright and versatile space, ideal for a variety of creative events. The studio has plenty of natural light and a flexible layout that can be adapted to suit a range of needs, from small workshops to larger events. The walls are adorned with beautiful artwork, providing an inspiring backdrop for any creative endeavor.";

type Props = {
  items: ArtistCardVM[];
};

export function LaxArtists({ items }: Props) {
  return (
    <section className="w-full max-w-[1440px] px-8 pb-24 pt-20 md:px-8">
      <div className="mx-auto flex max-w-[1376px] flex-col gap-12">
        <div className="relative min-h-[208px] w-full">
          <div className="flex flex-col gap-3 md:max-w-[50%]">
            <h2 className="font-headline text-[40px] font-semibold leading-[60px] text-brand-900">
              Artists
            </h2>
            <p className="font-headline text-2xl font-normal leading-6 text-brand-300">
              Carefully curated selections from our upcoming auctions
            </p>
          </div>
          <Link
            href="/artist/featured"
            className="mt-6 inline-flex items-center gap-[11px] font-label text-base font-semibold leading-6 tracking-[0.8px] text-brand-900 md:absolute md:right-0 md:top-1 md:mt-0"
          >
            View All
            <span
              className="inline-block h-5 w-5 border-r-[1.67px] border-b-[1.67px] border-brand-900 rotate-[-45deg]"
              aria-hidden
            />
          </Link>
          <p className="font-artists-serif mt-8 max-w-[625px] text-base font-light leading-[120%] text-brand-900 md:absolute md:right-0 md:top-[88px] md:mt-0">
            {ARTIST_BLURB}
          </p>
        </div>
        {items.length === 0 ? (
          <p className="font-body text-brand-400">No artists to display.</p>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((a) => (
              <Link
                key={a.id}
                href={a.href}
                className="group relative block aspect-[320/440] w-full overflow-hidden"
              >
                <Image
                  src={a.portraitUrl}
                  alt={a.name}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, 25vw"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <span className="font-label text-sm font-semibold uppercase tracking-wider text-white">
                    {a.name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
