import { ArtSectionHeader } from "@/components/layout/art-section";
import { ArtMediaImage } from "@/components/media/art-media-image";
import { ART_HUB_HEADINGS, type ArtHubFilmVm } from "@/lib/editorial/art-hub.vm";
import { MarketingVideoPoster } from "@auction/marketing-ui";
import Link from "next/link";

/**
 * Films (Figma `1010:20309`): the featured film across the page width with its kicker, title and
 * standfirst underneath. The poster opens the hosted film; the title opens its story page.
 */
export function ArtHubFilm({ film }: { film: ArtHubFilmVm }) {
  return (
    <section aria-labelledby="art-hub-films-title" className="flex flex-col gap-6">
      <ArtSectionHeader
        headingId="art-hub-films-title"
        title={ART_HUB_HEADINGS.films}
        viewAllHref="/stories/artists"
        viewAllSrLabel="stories and films"
      />
      <div className="flex flex-col gap-4">
        <MarketingVideoPoster
          href={film.videoUrl}
          title={film.title}
          className="rounded-none aspect-video lg:aspect-[21/9]"
          {...(film.imageUrl
            ? {
                poster: (
                  <ArtMediaImage
                    src={film.imageUrl}
                    alt=""
                    sizes="(min-width: 90rem) 1360px, 100vw"
                    className="absolute inset-0 size-full"
                    imgClassName="object-cover"
                  />
                ),
              }
            : {})}
        />
        <div className="flex flex-col gap-2">
          <p className="font-label text-xs leading-[1.125rem] text-on-surface-variant">Film</p>
          <h3 className="font-headline text-xl font-medium leading-7 text-on-surface md:text-[1.75rem] md:leading-tight">
            <Link href={film.href} className="art-focus-ring rounded-sm hover:underline">
              {film.title}
            </Link>
          </h3>
          {film.description ? (
            <p className="max-w-[60ch] text-base leading-7 text-on-surface-variant">
              {film.description}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
