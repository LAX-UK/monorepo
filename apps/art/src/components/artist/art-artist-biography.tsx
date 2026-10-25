import { ArtMediaImage } from "@/components/media/art-media-image";
import type { ArtistPageVm } from "@/lib/artist/artist-page.composer";
import { ART_MEDIA_LABELS } from "@/lib/media/art-media-labels";
import { MarketingReadMore } from "@auction/marketing-ui";

/**
 * Biography with a clamped "Read more" and, when one exists, the portrait beside it. The page
 * renders it only for an artist with a biography, so the heading never stands alone.
 */
export function ArtArtistBiography({ vm }: { vm: ArtistPageVm }) {
  return (
    <section
      aria-labelledby="artist-biography-title"
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:gap-16"
    >
      <div className="flex min-w-0 flex-col gap-4">
        <h2
          id="artist-biography-title"
          className="font-headline text-[length:var(--text-title-section)] font-medium leading-[1.2] text-on-surface"
        >
          Biography
        </h2>
        <MarketingReadMore lines={6} className="max-w-prose text-on-surface-variant">
          <p className="whitespace-pre-wrap">{vm.bio}</p>
        </MarketingReadMore>
      </div>
      {vm.portraitUrl ? (
        <div className="relative aspect-[8/11] w-full max-w-xs overflow-hidden bg-surface-container lg:max-w-none">
          <ArtMediaImage
            src={vm.portraitUrl}
            alt={vm.portraitAlt}
            aspect={[8, 11]}
            sizes="(min-width: 64rem) 20rem, 80vw"
            label={ART_MEDIA_LABELS.artistPortrait}
            className="absolute inset-0 size-full"
            imgClassName="object-cover"
          />
        </div>
      ) : null}
    </section>
  );
}
