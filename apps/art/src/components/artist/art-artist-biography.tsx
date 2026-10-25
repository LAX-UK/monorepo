import type { ArtistPageVm } from "@/lib/artist/artist-page.composer";
import { MarketingReadMore } from "@auction/marketing-ui";

/**
 * Biography with a clamped "Read more". The portrait sits in the hero above, so this section is
 * text only. The page renders it only for an artist with a biography.
 */
export function ArtArtistBiography({ vm }: { vm: ArtistPageVm }) {
  return (
    <section aria-labelledby="artist-biography-title" className="flex max-w-3xl flex-col gap-4">
      <h2
        id="artist-biography-title"
        className="font-headline text-[length:var(--text-title-section)] font-medium leading-[1.2] text-on-surface"
      >
        Biography
      </h2>
      <MarketingReadMore lines={6} className="max-w-prose text-on-surface-variant">
        <p className="whitespace-pre-wrap">{vm.bio}</p>
      </MarketingReadMore>
    </section>
  );
}
