import { ARTIST_SECTION_BLURB } from "@/components/sections/home/home-copy";
import type { ArtistCardVM } from "@/components/sections/home/home-view-models";
import { RevealInView } from "@/components/ui/reveal";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import { BodyText, DisplayHeading } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type Props = {
  items: ArtistCardVM[];
};

export function LaxArtists({ items }: Props) {
  return (
    <section className="mx-auto w-full max-w-[var(--container-max,1440px)] px-6 pb-20 pt-20 md:px-10 lg:px-14">
      <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col gap-12">
        <div className="relative min-h-[208px] w-full">
          <div className="flex flex-col gap-3 md:max-w-[50%]">
            <DisplayHeading
              as="h2"
              className="text-[40px] font-semibold leading-[60px] text-brand-900 dark:text-on-surface"
            >
              Artists
            </DisplayHeading>
            <BodyText className="font-headline text-2xl font-normal leading-6 text-brand-300 dark:text-on-surface-variant">
              Carefully curated selections from our upcoming auctions
            </BodyText>
          </div>
          <Button variant="chevron" asChild className="md:absolute md:right-0 md:top-1">
            <Link href="/artist/featured" className="mt-6 inline-flex items-center gap-2 md:mt-0">
              View all
              <span className="sr-only"> featured artists</span>
              <ChevronRight className="size-5 shrink-0" aria-hidden />
            </Link>
          </Button>
          <BodyText className="font-artists-serif mt-8 max-w-[625px] text-base font-light leading-[120%] text-brand-900 dark:text-on-surface md:absolute md:right-0 md:top-[88px] md:mt-0">
            {ARTIST_SECTION_BLURB}
          </BodyText>
        </div>
        {items.length === 0 ? (
          <BodyText className="text-brand-400 dark:text-on-surface-variant">
            No artists to display.
          </BodyText>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((a, index) => (
              <Link
                key={a.id}
                href={a.href}
                className="group relative block aspect-[320/440] w-full overflow-hidden"
              >
                <RevealInView
                  className="absolute inset-0 overflow-hidden"
                  innerClassName="absolute inset-0"
                  delayMs={Math.min(index * 70, 280)}
                >
                  <Image
                    src={a.portraitUrl}
                    alt={a.name}
                    fill
                    placeholder="blur"
                    blurDataURL={TINY_IMAGE_BLUR}
                    className="object-cover transition-transform duration-700 motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100"
                    sizes="(max-width: 640px) 100vw, 25vw"
                  />
                </RevealInView>
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-10 dark:from-black/85">
                  <span className="font-label text-sm font-semibold uppercase tracking-wider text-hero-foreground">
                    {a.name}
                  </span>
                  <span className="font-body text-xs text-white/60 underline-offset-2 group-hover:underline">
                    View profile
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
